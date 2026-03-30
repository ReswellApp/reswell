/**
 * Client-side listing photo pipeline: decode → resize (long edge cap) → WebP (or JPEG fallback).
 */

export const LISTING_IMAGE_MAX_ORIGINAL_BYTES = 20 * 1024 * 1024
export const LISTING_FULL_MAX_LONG_EDGE = 2000
export const LISTING_THUMB_MAX_LONG_EDGE = 400
export const LISTING_WEBP_QUALITY_FULL = 0.82
export const LISTING_WEBP_QUALITY_THUMB = 0.7

export type PreparedListingImagePair = {
  full: Blob
  thumb: Blob
  fullContentType: "image/webp" | "image/jpeg"
  thumbContentType: "image/webp" | "image/jpeg"
  fullExt: "webp" | "jpg"
  thumbExt: "webp" | "jpg"
}

let webpEncodeSupported: boolean | null = null

export function assertListingOriginalSize(file: File): void {
  if (file.size > LISTING_IMAGE_MAX_ORIGINAL_BYTES) {
    throw new Error(
      `This file is over 20MB. Choose a smaller photo (yours is ${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
    )
  }
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

async function renderResizedToBlob(
  bitmap: ImageBitmap,
  maxLongEdge: number,
  quality: number,
  useWebp: boolean,
): Promise<{ blob: Blob; contentType: "image/webp" | "image/jpeg"; ext: "webp" | "jpg" }> {
  const { width: tw, height: th } = longEdgeDimensions(bitmap.width, bitmap.height, maxLongEdge)
  const canvas = document.createElement("canvas")
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas not available")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(bitmap, 0, 0, tw, th)
  return canvasToImageBlob(canvas, useWebp, quality)
}

/**
 * Single decode; produces full (≤2000px long edge) + thumb (≤400px) in one pipeline step.
 */
export async function prepareListingImagePairFromFile(file: File): Promise<PreparedListingImagePair> {
  const bitmap = await createImageBitmap(file)
  try {
    const useWebp = await canvasSupportsWebp()
    const [fullPack, thumbPack] = await Promise.all([
      renderResizedToBlob(bitmap, LISTING_FULL_MAX_LONG_EDGE, LISTING_WEBP_QUALITY_FULL, useWebp),
      renderResizedToBlob(bitmap, LISTING_THUMB_MAX_LONG_EDGE, LISTING_WEBP_QUALITY_THUMB, useWebp),
    ])
    return {
      full: fullPack.blob,
      thumb: thumbPack.blob,
      fullContentType: fullPack.contentType,
      thumbContentType: thumbPack.contentType,
      fullExt: fullPack.ext,
      thumbExt: thumbPack.ext,
    }
  } finally {
    bitmap.close()
  }
}
