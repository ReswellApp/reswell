"use client"

import {
  browserCanDecodeImage,
  isRetryableImageError,
  prepareListingImagePairFromFile,
  type PreparedListingImagePair,
  type PrepareListingImagePairOptions,
} from "@/lib/listing-image-pipeline"
import { runImageCpuTask } from "@/lib/client-image-cpu-queue"
import {
  canonicalDeclaredMime,
  normalizeListingImageFile,
  sniffImageMime,
} from "@/lib/sell-flow/listing-photo-file"
import { SERVER_IMAGE_CONVERT_MAX_BYTES } from "@/lib/utils/server-image-convert"
import { isStaleFileNotFoundError } from "@/lib/utils/is-stale-file-not-found-error"

export { SERVER_IMAGE_CONVERT_MAX_BYTES }

const DECODABLE_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
])

function isAppleMobileSafari(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

/**
 * Skip the expensive createImageBitmap probe for formats (and platforms) where the sell pipeline
 * already decodes successfully. Probing every iPhone photo before prepare caused a second full-res
 * decode and was a primary trigger for iOS Safari's "operation was aborted" OOM errors.
 */
function isLikelyBrowserDecodableWithoutProbe(file: File): boolean {
  const mime = canonicalDeclaredMime(file.type)
  if (mime && DECODABLE_IMAGE_MIMES.has(mime)) return true

  const lowerName = file.name.toLowerCase()
  if (/\.(jpe?g|jfif|png|webp|gif|avif|bmp)$/i.test(lowerName)) return true

  if (isAppleMobileSafari()) {
    if (
      mime.includes("heic") ||
      mime.includes("heif") ||
      lowerName.endsWith(".heic") ||
      lowerName.endsWith(".heif")
    ) {
      return true
    }
    // Camera roll picks often omit MIME; trust common photo extensions on iOS.
    if (!mime && /\.(jpe?g|heic|heif)$/i.test(lowerName)) return true
  }

  return false
}

function conversionErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) return message.trim()
  }
  if (typeof err === "string" && err.trim()) return err.trim()
  return "conversion failed"
}

async function fileLooksLikeHeic(file: File): Promise<boolean> {
  const lowerName = file.name.toLowerCase()
  const mimeLower = canonicalDeclaredMime(file.type)
  if (
    lowerName.endsWith(".heic") ||
    lowerName.endsWith(".heif") ||
    mimeLower.includes("heic") ||
    mimeLower.includes("heif")
  ) {
    return true
  }

  try {
    const head = new Uint8Array(await file.slice(0, 32).arrayBuffer())
    return sniffImageMime(head) === "image/heic"
  } catch (err) {
    if (isStaleFileNotFoundError(err)) throw err
    return false
  }
}

function jpegFileFromBlob(source: File, blob: Blob): File {
  const base = source.name.replace(/\.[^.]+$/i, "") || "image"
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" })
}

/** Finder / Photos drops often omit MIME — libheif decoders expect image/heic. */
async function heicInputBlob(file: File): Promise<Blob> {
  const mime = (file.type || "").toLowerCase()
  if (mime.includes("heic") || mime.includes("heif")) return file
  const buffer = await file.arrayBuffer()
  return new Blob([buffer], { type: "image/heic" })
}

async function convertHeicWithHeicTo(blob: Blob): Promise<Blob> {
  const { heicTo } = await import("heic-to")
  return heicTo({
    blob,
    type: "image/jpeg",
    quality: 0.92,
  })
}

async function convertHeicWithHeic2Any(blob: Blob): Promise<Blob> {
  const heic2any = (await import("heic2any")).default
  const result = await heic2any({
    blob,
    toType: "image/jpeg",
    quality: 0.92,
    /** Required by heic2any — undefined rejects with ERR_USER. */
    multiple: false,
  })
  const out = Array.isArray(result) ? result[0] : result
  if (!out || out.size === 0) {
    throw new Error("HEIC conversion produced an empty file")
  }
  return out
}

async function convertHeicClientSide(file: File): Promise<File> {
  if (typeof window === "undefined") {
    throw new Error("HEIC conversion requires a browser")
  }

  const blob = await heicInputBlob(file)
  const attempts: string[] = []

  try {
    const jpegBlob = await convertHeicWithHeicTo(blob)
    return jpegFileFromBlob(file, jpegBlob)
  } catch (err) {
    attempts.push(`heic-to: ${conversionErrorMessage(err)}`)
  }

  try {
    const jpegBlob = await convertHeicWithHeic2Any(blob)
    return jpegFileFromBlob(file, jpegBlob)
  } catch (err) {
    const msg = conversionErrorMessage(err)
    if (msg.includes("already browser readable")) {
      if (await browserCanDecodeImage(file)) return file
    }
    attempts.push(`heic2any: ${msg}`)
  }

  throw new Error(attempts.join("; "))
}

async function convertViaServer(file: File): Promise<File> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch("/api/convert-image", { method: "POST", body: form })
  const ct = res.headers.get("content-type") || ""
  if (!res.ok) {
    let msg = "Server could not convert this image to JPEG"
    try {
      if (ct.includes("application/json")) {
        const j = (await res.json()) as { error?: string }
        if (j?.error) msg = j.error
      } else {
        const t = await res.text()
        if (t) msg = t.slice(0, 240)
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  if (!ct.includes("image/jpeg")) {
    throw new Error("Server did not return a JPEG image")
  }
  const out = await res.blob()
  return jpegFileFromBlob(file, out)
}

/**
 * Returns a JPEG (or browser-decodable) {@link File} suitable for canvas / createImageBitmap pipelines.
 *
 * iPhone / iPad Safari: HEIC is left as-is — Safari decodes it natively, and the listing pipeline
 * downscales during createImageBitmap so 48MP camera roll photos never need WASM or a server hop.
 *
 * Other browsers: HEIC is converted client-side (heic-to / heic2any). Server convert is only a
 * last resort under Vercel's ~4.5MB body limit — large iPhone HEIC must succeed on-device.
 */
async function convertHeicOrThrow(file: File): Promise<File> {
  try {
    // Desktop Chrome/Firefox/Edge HEIC: wasm convert, serialized so batch picks don't freeze the UI.
    return await runImageCpuTask(() => convertHeicClientSide(file))
  } catch (err) {
    if (isStaleFileNotFoundError(err)) throw err
    if (file.size <= SERVER_IMAGE_CONVERT_MAX_BYTES) {
      try {
        return await convertViaServer(file)
      } catch (serverErr) {
        if (isAuthConvertError(serverErr)) throw serverErr
      }
    }
    const hint = conversionErrorMessage(err)
    throw new Error(
      `Could not read this HEIC photo (${hint}). On iPhone, try again; on desktop, export as JPEG from Photos.`,
    )
  }
}

function isAuthConvertError(err: unknown): boolean {
  return /unauthorized|sign in/i.test(conversionErrorMessage(err))
}

function isBrowserDecodeFailure(err: unknown): boolean {
  const message = conversionErrorMessage(err).toLowerCase()
  return (
    message.includes("could not decode") ||
    message.includes("could not read image") ||
    message.includes("source image could not be decoded") ||
    message.includes("invalidstateerror") ||
    message.includes("encodingerror") ||
    message.includes("notsupportederror") ||
    message.includes("failed to load")
  )
}

/**
 * Last resort after canvas decode fails: HEIC wasm, then Sharp on the server (CMYK JPEG,
 * TIFF, BMP, and other files Chrome on Windows cannot paint).
 */
export async function recoverUndecodableListingImage(file: File): Promise<File | null> {
  if (await fileLooksLikeHeic(file)) {
    if (isAppleMobileSafari()) return null
    return convertHeicOrThrow(file)
  }

  if (file.size > SERVER_IMAGE_CONVERT_MAX_BYTES) return null

  try {
    return await convertViaServer(file)
  } catch (err) {
    if (isStaleFileNotFoundError(err) || isAuthConvertError(err)) throw err
    return null
  }
}

export async function ensureBrowserDecodableImageFile(file: File): Promise<File> {
  const normalized = await normalizeListingImageFile(file)

  // Sniff before the fast path. A `.jpg` label on Windows is often HEIC bytes from an iPhone.
  if (await fileLooksLikeHeic(normalized)) {
    // iOS Safari decodes HEIC natively. WASM here doubles peak memory and trips OOM aborts.
    if (isAppleMobileSafari()) return normalized
    return convertHeicOrThrow(normalized)
  }

  // iOS Safari + common JPEG/PNG: skip probes and HEIC WASM. Native decode handles full megapixel HEIC.
  if (isLikelyBrowserDecodableWithoutProbe(normalized)) return normalized

  if (await browserCanDecodeImage(normalized)) return normalized

  if (normalized.size > SERVER_IMAGE_CONVERT_MAX_BYTES) {
    throw new Error(
      `This photo format isn't supported in your browser and the file is too large to convert online (${(normalized.size / (1024 * 1024)).toFixed(1)}MB). Export as JPEG or PNG and try again.`,
    )
  }

  return convertViaServer(normalized)
}

/**
 * Normalize Windows MIME / HEIC-in-JPEG files, then build the listing derivatives.
 * If the browser still cannot decode (CMYK JPEG, TIFF), convert once and retry.
 */
export async function prepareDecodableListingPhoto(
  file: File,
  options?: PrepareListingImagePairOptions,
): Promise<PreparedListingImagePair> {
  const decodable = await ensureBrowserDecodableImageFile(file)
  try {
    return await prepareListingImagePairFromFile(decodable, options)
  } catch (err) {
    if (isRetryableImageError(err) || isStaleFileNotFoundError(err)) throw err
    if (!isBrowserDecodeFailure(err)) throw err
    const recovered = await recoverUndecodableListingImage(decodable)
    if (!recovered) {
      throw new Error(
        "This photo format isn't supported in your browser. Export it as a standard JPEG or PNG and try again.",
      )
    }
    return prepareListingImagePairFromFile(recovered, options)
  }
}
