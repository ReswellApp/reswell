/**
 * Client-side message photo pipeline: decode → resize (long edge cap) → WebP (or JPEG fallback).
 * Same encoding approach as listing photos, without listing-specific portrait rotation.
 */

import {
  LISTING_FULL_MAX_LONG_EDGE,
  LISTING_IMAGE_MAX_ORIGINAL_BYTES,
  LISTING_WEBP_QUALITY_FULL,
} from "@/lib/listing-image-pipeline"

export { LISTING_IMAGE_MAX_ORIGINAL_BYTES as MESSAGE_IMAGE_MAX_ORIGINAL_BYTES }

// Sized for ~2 minutes of high-bitrate phone footage (4K HEVC) without transcoding.
export const MESSAGE_VIDEO_MAX_BYTES = 500 * 1024 * 1024

export const MESSAGE_VIDEO_MAX_DURATION_SECONDS = 120

export const MESSAGE_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const

export type MessageVideoMimeType = (typeof MESSAGE_VIDEO_MIME_TYPES)[number]

/** Tight `<input accept>` — matches storage allowlist + HEIC (converted client-side). */
export const MESSAGE_MEDIA_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"

const MESSAGE_IMAGE_NAME_RE = /\.(jpe?g|png|webp|gif|heic|heif)$/i
const MESSAGE_VIDEO_NAME_RE = /\.(mp4|mov|webm)$/i

export function isAcceptedMessageImageFile(file: File): boolean {
  const mime = (file.type || "").toLowerCase()
  if (
    mime === "image/jpeg" ||
    mime === "image/png" ||
    mime === "image/webp" ||
    mime === "image/gif" ||
    mime === "image/heic" ||
    mime === "image/heif" ||
    mime.includes("heic") ||
    mime.includes("heif")
  ) {
    return true
  }
  // iOS camera-roll picks often omit MIME.
  return !mime && MESSAGE_IMAGE_NAME_RE.test(file.name)
}

export function isAcceptedMessageVideoFile(file: File): boolean {
  const mime = (file.type || "").toLowerCase()
  if (mime === "video/mp4" || mime === "video/quicktime" || mime === "video/webm") {
    return true
  }
  return MESSAGE_VIDEO_NAME_RE.test(file.name)
}

export function isAcceptedMessageMediaFile(file: File): boolean {
  return isAcceptedMessageImageFile(file) || isAcceptedMessageVideoFile(file)
}

export function assertAcceptedMessageMediaFile(file: File): void {
  if (!isAcceptedMessageMediaFile(file)) {
    throw new Error(
      "That file type isn't supported. Try a JPEG, PNG, WebP, GIF, or an MP4/MOV video.",
    )
  }
}

export type PreparedMessageImage = {
  blob: Blob
  contentType: "image/webp" | "image/jpeg" | "image/png" | "image/gif"
  ext: "webp" | "jpg" | "png" | "gif"
  width: number
  height: number
}

let webpEncodeSupported: boolean | null = null

export function assertMessageImageOriginalSize(file: File): void {
  if (file.size > LISTING_IMAGE_MAX_ORIGINAL_BYTES) {
    throw new Error(
      `This photo is over 20MB. Choose a smaller file (yours is ${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
    )
  }
}

export function assertMessageVideoOriginalSize(file: File): void {
  if (file.size > MESSAGE_VIDEO_MAX_BYTES) {
    throw new Error(
      `This video is over 500MB. Choose a smaller file (yours is ${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
    )
  }
}

/**
 * Reads video duration via an off-screen <video> element. Returns null when the
 * browser cannot decode the file's metadata (we allow those through; size still caps them).
 */
export function readMessageVideoDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement("video")
    video.preload = "metadata"

    const finish = (duration: number | null) => {
      URL.revokeObjectURL(objectUrl)
      video.removeAttribute("src")
      video.load()
      resolve(duration)
    }

    video.onloadedmetadata = () => {
      finish(Number.isFinite(video.duration) ? video.duration : null)
    }
    video.onerror = () => finish(null)
    video.src = objectUrl
  })
}

export async function assertMessageVideoDuration(file: File): Promise<void> {
  const duration = await readMessageVideoDurationSeconds(file)
  if (duration != null && duration > MESSAGE_VIDEO_MAX_DURATION_SECONDS) {
    const minutes = Math.floor(duration / 60)
    const seconds = Math.round(duration % 60)
    throw new Error(
      `Videos can be up to 2 minutes long (yours is ${minutes}:${String(seconds).padStart(2, "0")}). Trim it and try again.`,
    )
  }
}

export function isMessageVideoFile(file: File): boolean {
  return file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name)
}

export async function browserCanDecodeImage(file: File): Promise<boolean> {
  try {
    const b = await createImageBitmap(file)
    b.close()
    return true
  } catch {
    return false
  }
}

async function canvasSupportsWebp(): Promise<boolean> {
  if (webpEncodeSupported != null) return webpEncodeSupported
  const ok = await new Promise<boolean>((resolve) => {
    const c = document.createElement("canvas")
    c.width = 4
    c.height = 4
    c.toBlob((b) => resolve(!!b && b.type === "image/webp"), "image/webp", 0.92)
  })
  webpEncodeSupported = ok
  return ok
}

function longEdgeDimensions(w: number, h: number, maxLong: number): { width: number; height: number } {
  const long = Math.max(w, h)
  if (long <= maxLong) return { width: w, height: h }
  const scale = maxLong / long
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  }
}

function canvasToImageBlob(
  canvas: HTMLCanvasElement,
  preferWebp: boolean,
  quality: number,
): Promise<{ blob: Blob; contentType: "image/webp" | "image/jpeg"; ext: "webp" | "jpg" }> {
  return new Promise((resolve, reject) => {
    const done = (blob: Blob | null, type: "image/webp" | "image/jpeg", ext: "webp" | "jpg") => {
      if (!blob) {
        reject(new Error("Could not encode image"))
        return
      }
      resolve({ blob, contentType: type, ext })
    }

    if (preferWebp) {
      canvas.toBlob(
        (b) => {
          if (b && b.size > 0 && b.type === "image/webp") {
            done(b, "image/webp", "webp")
            return
          }
          canvas.toBlob((j) => done(j, "image/jpeg", "jpg"), "image/jpeg", quality)
        },
        "image/webp",
        quality,
      )
    } else {
      canvas.toBlob((j) => done(j, "image/jpeg", "jpg"), "image/jpeg", quality)
    }
  })
}

export async function prepareMessageImageFromFile(file: File): Promise<PreparedMessageImage> {
  if (file.type === "image/gif") {
    assertMessageImageOriginalSize(file)
    const bitmap = await createImageBitmap(file)
    try {
      return {
        blob: file,
        contentType: "image/gif",
        ext: "gif",
        width: bitmap.width,
        height: bitmap.height,
      }
    } finally {
      bitmap.close()
    }
  }

  let bitmap = await createImageBitmap(file)
  try {
    const useWebp = await canvasSupportsWebp()
    const { width: tw, height: th } = longEdgeDimensions(
      bitmap.width,
      bitmap.height,
      LISTING_FULL_MAX_LONG_EDGE,
    )
    const canvas = document.createElement("canvas")
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas not available")
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(bitmap, 0, 0, tw, th)
    const encoded = await canvasToImageBlob(canvas, useWebp, LISTING_WEBP_QUALITY_FULL)
    return {
      blob: encoded.blob,
      contentType: encoded.contentType,
      ext: encoded.ext,
      width: tw,
      height: th,
    }
  } finally {
    bitmap.close()
  }
}

export function normalizeMessageVideoMimeType(file: File): MessageVideoMimeType {
  const type = file.type.toLowerCase()
  if (type === "video/quicktime" || /\.mov$/i.test(file.name)) return "video/quicktime"
  if (type === "video/webm" || /\.webm$/i.test(file.name)) return "video/webm"
  return "video/mp4"
}

export function messageVideoExtensionForMime(mime: MessageVideoMimeType): "mp4" | "mov" | "webm" {
  if (mime === "video/quicktime") return "mov"
  if (mime === "video/webm") return "webm"
  return "mp4"
}
