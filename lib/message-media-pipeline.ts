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

export const MESSAGE_VIDEO_MAX_BYTES = 50 * 1024 * 1024

export const MESSAGE_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const

export type MessageVideoMimeType = (typeof MESSAGE_VIDEO_MIME_TYPES)[number]

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
      `This video is over 50MB. Choose a smaller file (yours is ${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
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
