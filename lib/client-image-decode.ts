"use client"

import { browserCanDecodeImage } from "@/lib/listing-image-pipeline"
import { runImageCpuTask } from "@/lib/client-image-cpu-queue"

/** Vercel serverless request bodies are capped at ~4.5MB; stay under for FormData overhead. */
export const SERVER_IMAGE_CONVERT_MAX_BYTES = 4 * 1024 * 1024

const HEIC_BRAND_RE = /^(heic|heix|hevc|hevx|mif1|msf1|heim|heis|hevm|hevs)$/i

function conversionErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) return message.trim()
  }
  if (typeof err === "string" && err.trim()) return err.trim()
  return "conversion failed"
}

function bufferLooksLikeHeif(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  const ftyp = String.fromCharCode(bytes[4]!, bytes[5]!, bytes[6]!, bytes[7]!)
  if (ftyp !== "ftyp") return false
  const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!)
    .replace(/\0/g, "")
    .trim()
  return HEIC_BRAND_RE.test(brand)
}

async function fileLooksLikeHeic(file: File): Promise<boolean> {
  const lowerName = file.name.toLowerCase()
  const mimeLower = (file.type || "").toLowerCase()
  if (
    lowerName.endsWith(".heic") ||
    lowerName.endsWith(".heif") ||
    mimeLower.includes("heic") ||
    mimeLower.includes("heif")
  ) {
    return true
  }

  try {
    const head = await file.slice(0, 12).arrayBuffer()
    return bufferLooksLikeHeif(new Uint8Array(head))
  } catch {
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
 * HEIC/HEIF is converted in the browser first so large iPhone photos never hit Vercel's ~4.5MB body limit.
 */
export async function ensureBrowserDecodableImageFile(file: File): Promise<File> {
  if (await browserCanDecodeImage(file)) return file

  const heicish = await fileLooksLikeHeic(file)
  if (heicish) {
    try {
      // HEIC decode is heavy main-thread wasm; serialize so parallel photo adds don't freeze scroll.
      return await runImageCpuTask(() => convertHeicClientSide(file))
    } catch (err) {
      if (file.size <= SERVER_IMAGE_CONVERT_MAX_BYTES) {
        try {
          return await convertViaServer(file)
        } catch {
          /* fall through */
        }
      }
      const hint = conversionErrorMessage(err)
      throw new Error(
        `Could not convert this HEIC/HEIF photo (${hint}). Try exporting as JPEG from Photos, or use a smaller file.`,
      )
    }
  }

  if (file.size > SERVER_IMAGE_CONVERT_MAX_BYTES) {
    throw new Error(
      `This photo format isn't supported in your browser and the file is too large to convert online (${(file.size / (1024 * 1024)).toFixed(1)}MB). Export as JPEG or PNG and try again.`,
    )
  }

  return convertViaServer(file)
}
