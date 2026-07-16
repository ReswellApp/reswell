/**
 * Client-side listing photo pipeline: decode → resize (long edge cap) → WebP (or JPEG fallback).
 */

import { runImageCpuTask, runImagePrepareTask } from "@/lib/client-image-cpu-queue"
import { prepareListingImagePairInWorker } from "@/lib/listing-image-worker"
import { isAbortError } from "@/lib/utils/is-abort-error"

export const LISTING_IMAGE_MAX_ORIGINAL_BYTES = 20 * 1024 * 1024
export const LISTING_FULL_MAX_LONG_EDGE = 2000
/** Browse grids (retina / 2–5 columns) need ~600px+ long edge so thumbs are not upscaled and look soft. */
export const LISTING_THUMB_MAX_LONG_EDGE = 640
export const LISTING_WEBP_QUALITY_FULL = 0.82
export const LISTING_WEBP_QUALITY_THUMB = 0.74

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
  // Gated: this fully decodes the image just to probe support. Run un-bounded for a batch of large
  // photos it was a primary contributor to the iOS "operation was aborted" out-of-memory storm.
  return runImagePrepareTask(async () => {
    try {
      const b = await createImageBitmap(file)
      b.close()
      return true
    } catch (err) {
      // Memory-pressure aborts must propagate — returning false would wrongly route JPEG/PNG into
      // HEIC/server conversion and still fail with "operation was aborted".
      if (isRetryableImageError(err)) throw err
      return false
    }
  })
}

/** Transient, memory-pressure failures (mobile Safari aborts decode under load) — safe to retry. */
function isRetryableImageError(err: unknown): boolean {
  if (isAbortError(err)) return true
  const message = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase()
  return (
    message.includes("out of memory") ||
    message.includes("memory") ||
    message.includes("insufficient resources") ||
    message.includes("allocation")
  )
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Retries an image step a few times when it fails with a transient memory/abort error. Because work
 * is serialized through {@link runImagePrepareTask}, waiting lets earlier photos release memory so
 * the retry succeeds instead of permanently failing the tile.
 */
async function withTransientImageRetry<T>(task: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await task()
    } catch (err) {
      lastError = err
      if (!isRetryableImageError(err) || attempt === attempts - 1) throw err
      await sleep(200 * (attempt + 1))
    }
  }
  throw lastError
}

type DecodedImageSource = {
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}

/** Decode via an <img> element — a fallback when createImageBitmap rejects (format/EXIF edge cases). */
function decodeViaImageElement(file: File): Promise<DecodedImageSource> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.decoding = "async"
    img.onload = () => {
      const width = img.naturalWidth
      const height = img.naturalHeight
      if (!width || !height) {
        URL.revokeObjectURL(url)
        reject(new Error("Could not read image dimensions"))
        return
      }
      resolve({
        source: img,
        width,
        height,
        release: () => URL.revokeObjectURL(url),
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Could not decode image"))
    }
    img.src = url
  })
}

/**
 * Decode and downscale in one step so 48MP iPhone HEIC never materializes at full resolution.
 * Long edge is capped to {@link LISTING_FULL_MAX_LONG_EDGE} (listing output size) — enough for
 * marketplace quality, ~10× less peak memory than a raw Pro camera bitmap.
 */
export async function createImageBitmapMaxLongEdge(
  blob: Blob,
  maxLongEdge: number = LISTING_FULL_MAX_LONG_EDGE,
): Promise<ImageBitmap> {
  const opts = {
    imageOrientation: "from-image" as const,
    resizeQuality: "high" as const,
  }

  // Portrait-primary (most sell photos after EXIF): constrain height first.
  let bitmap = await createImageBitmap(blob, {
    ...opts,
    resizeHeight: maxLongEdge,
  })
  if (bitmap.width <= maxLongEdge) return bitmap

  // Landscape / ultra-wide after orientation — constrain width instead.
  bitmap.close()
  bitmap = await createImageBitmap(blob, {
    ...opts,
    resizeWidth: maxLongEdge,
  })
  return bitmap
}

/** Single source of truth for main-thread decode: prefer createImageBitmap, fall back to <img>. */
async function decodeImageSource(file: File): Promise<DecodedImageSource> {
  try {
    // Downscale during decode — critical for full-megapixel iPhone HEIC on mobile Safari.
    const bitmap = await createImageBitmapMaxLongEdge(file, LISTING_FULL_MAX_LONG_EDGE)
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    }
  } catch (err) {
    if (!isRetryableImageError(err)) {
      // Genuine decode failure (not memory) — try the <img> path which handles some formats/EXIF
      // cases createImageBitmap rejects. Modern browsers apply EXIF orientation to <img> by default.
      return decodeViaImageElement(file)
    }
    throw err
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

type Drawable = { source: CanvasImageSource; width: number; height: number }

function drawToCanvas(
  src: Drawable,
  outWidth: number,
  outHeight: number,
  transform: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = outWidth
  canvas.height = outHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas not available")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  transform(ctx)
  return canvas
}

/**
 * Listing UIs expect portrait-oriented assets (height ≥ width). Landscape photos are rotated
 * 90° counter-clockwise so the long edge becomes vertical — no user-facing rejection for orientation.
 * Square images are unchanged.
 */
function rotateLandscapeToPortraitIfNeeded(src: Drawable): Drawable {
  if (src.height >= src.width) return src
  const w = src.width
  const h = src.height
  const canvas = drawToCanvas(src, h, w, (ctx) => {
    ctx.translate(0, w)
    ctx.rotate(-Math.PI / 2)
    ctx.drawImage(src.source, 0, 0)
  })
  return { source: canvas, width: h, height: w }
}

/** Returns an upside-down copy of `src`. */
function rotate180(src: Drawable): Drawable {
  const w = src.width
  const h = src.height
  const canvas = drawToCanvas(src, w, h, (ctx) => {
    ctx.translate(w, h)
    ctx.rotate(Math.PI)
    ctx.drawImage(src.source, 0, 0)
  })
  return { source: canvas, width: w, height: h }
}

export type PrepareListingImagePairOptions = {
  /** Applied after landscape→portrait normalization so listing geometry rules stay the same. */
  rotate180?: boolean
}

async function renderResizedToBlob(
  src: Drawable,
  maxLongEdge: number,
  quality: number,
  useWebp: boolean,
): Promise<{ blob: Blob; contentType: "image/webp" | "image/jpeg"; ext: "webp" | "jpg" }> {
  const { width: tw, height: th } = longEdgeDimensions(src.width, src.height, maxLongEdge)
  const canvas = drawToCanvas(src, tw, th, (ctx) => {
    ctx.drawImage(src.source, 0, 0, tw, th)
  })
  return canvasToImageBlob(canvas, useWebp, quality)
}

/** Main-thread fallback when the OffscreenCanvas worker is unavailable or fails mid-flight. */
async function prepareListingImagePairOnMainThread(
  file: File,
  options?: PrepareListingImagePairOptions,
): Promise<PreparedListingImagePair> {
  const decoded = await decodeImageSource(file)
  try {
    let drawable: Drawable = decoded
    drawable = rotateLandscapeToPortraitIfNeeded(drawable)
    if (options?.rotate180) {
      drawable = rotate180(drawable)
    }
    const useWebp = await canvasSupportsWebp()
    const [fullPack, thumbPack] = await Promise.all([
      renderResizedToBlob(drawable, LISTING_FULL_MAX_LONG_EDGE, LISTING_WEBP_QUALITY_FULL, useWebp),
      renderResizedToBlob(drawable, LISTING_THUMB_MAX_LONG_EDGE, LISTING_WEBP_QUALITY_THUMB, useWebp),
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
    decoded.release()
  }
}

/**
 * Single decode; produces full (≤2000px long edge) + thumb (≤640px) in one pipeline step.
 *
 * Runs in an OffscreenCanvas worker when supported so heavy canvas work never blocks scrolling on
 * mobile; otherwise falls back to a main-thread path serialized through the shared CPU queue.
 */
export async function prepareListingImagePairFromFile(
  file: File,
  options?: PrepareListingImagePairOptions,
): Promise<PreparedListingImagePair> {
  // One memory slot per photo across BOTH the worker and main-thread paths so a batch of large
  // photos is decoded a few at a time — the fix for mobile Safari's out-of-memory aborts.
  return runImagePrepareTask(() =>
    withTransientImageRetry(async () => {
      try {
        const viaWorker = await prepareListingImagePairInWorker(file, options)
        if (viaWorker) return viaWorker
      } catch (err) {
        // A transient worker memory abort should bubble so the retry wrapper can back off and try
        // again; only non-transient worker failures fall through to the main-thread pipeline.
        if (isRetryableImageError(err)) throw err
      }
      try {
        return await runImageCpuTask(() => prepareListingImagePairOnMainThread(file, options))
      } catch (err) {
        if (isRetryableImageError(err)) throw err
        throw err
      }
    }),
  )
}
