"use client"

import type {
  PreparedListingImagePair,
  PrepareListingImagePairOptions,
} from "@/lib/listing-image-pipeline"
import {
  LISTING_FULL_MAX_LONG_EDGE,
  LISTING_THUMB_MAX_LONG_EDGE,
  LISTING_WEBP_QUALITY_FULL,
  LISTING_WEBP_QUALITY_THUMB,
} from "@/lib/listing-image-pipeline"

/**
 * OffscreenCanvas worker that decodes, orients, resizes and encodes a listing photo entirely off
 * the main thread. Built from an inline blob URL so it ships without bundler-specific worker config.
 * A single shared worker serializes requests, so the main thread stays free for scroll/paint while
 * photos process. Returns `null` when the platform lacks Worker/OffscreenCanvas support so callers
 * can fall back to the synchronous main-thread pipeline.
 */

const WORKER_SOURCE = `
self.onmessage = async function (e) {
  var msg = e.data
  try {
    var blob = msg.file instanceof Blob
      ? msg.file
      : new Blob([msg.buffer], { type: msg.type || "image/jpeg" })
    var bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" })
    var src = bitmap
    var w = bitmap.width
    var h = bitmap.height

    if (w > h) {
      var lc = new OffscreenCanvas(h, w)
      var lx = lc.getContext("2d")
      lx.imageSmoothingEnabled = true
      lx.imageSmoothingQuality = "high"
      lx.translate(0, w)
      lx.rotate(-Math.PI / 2)
      lx.drawImage(src, 0, 0)
      src = lc
      var swap = w
      w = h
      h = swap
    }

    if (msg.rotate180) {
      var rc = new OffscreenCanvas(w, h)
      var rx = rc.getContext("2d")
      rx.imageSmoothingEnabled = true
      rx.imageSmoothingQuality = "high"
      rx.translate(w, h)
      rx.rotate(Math.PI)
      rx.drawImage(src, 0, 0)
      src = rc
    }

    function longEdge(width, height, maxLong) {
      var long = Math.max(width, height)
      if (long <= maxLong) return { width: width, height: height }
      var scale = maxLong / long
      return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
      }
    }

    async function encode(canvas, preferWebp, quality) {
      if (preferWebp) {
        try {
          var b = await canvas.convertToBlob({ type: "image/webp", quality: quality })
          if (b && b.size > 0 && b.type === "image/webp") {
            return { blob: b, contentType: "image/webp", ext: "webp" }
          }
        } catch (err) {}
      }
      var j = await canvas.convertToBlob({ type: "image/jpeg", quality: quality })
      return { blob: j, contentType: "image/jpeg", ext: "jpg" }
    }

    async function render(maxLong, quality, preferWebp) {
      var d = longEdge(w, h, maxLong)
      var canvas = new OffscreenCanvas(d.width, d.height)
      var ctx = canvas.getContext("2d")
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(src, 0, 0, d.width, d.height)
      return encode(canvas, preferWebp, quality)
    }

    var full = await render(msg.fullMax, msg.qFull, true)
    var thumb = await render(msg.thumbMax, msg.qThumb, full.contentType === "image/webp")
    if (bitmap.close) bitmap.close()

    self.postMessage({
      id: msg.id,
      ok: true,
      full: full.blob,
      thumb: thumb.blob,
      fullContentType: full.contentType,
      thumbContentType: thumb.contentType,
      fullExt: full.ext,
      thumbExt: thumb.ext,
    })
  } catch (err) {
    self.postMessage({
      id: msg.id,
      ok: false,
      error: err && err.message ? err.message : String(err),
    })
  }
}
`

type WorkerResult = {
  id: number
  ok: boolean
  error?: string
  full?: Blob
  thumb?: Blob
  fullContentType?: PreparedListingImagePair["fullContentType"]
  thumbContentType?: PreparedListingImagePair["thumbContentType"]
  fullExt?: PreparedListingImagePair["fullExt"]
  thumbExt?: PreparedListingImagePair["thumbExt"]
}

type Pending = {
  resolve: (value: PreparedListingImagePair) => void
  reject: (reason: Error) => void
}

let worker: Worker | null = null
let workerUnavailable = false
let nextRequestId = 1
const pending = new Map<number, Pending>()

function platformSupportsOffscreenPipeline(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof OffscreenCanvas.prototype.convertToBlob === "function" &&
    typeof createImageBitmap === "function"
  )
}

function rejectAllPending(reason: Error): void {
  for (const p of pending.values()) p.reject(reason)
  pending.clear()
}

function getWorker(): Worker | null {
  if (workerUnavailable) return null
  if (worker) return worker
  if (!platformSupportsOffscreenPipeline()) {
    workerUnavailable = true
    return null
  }
  try {
    const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" })
    const url = URL.createObjectURL(blob)
    const w = new Worker(url)
    w.onmessage = (event: MessageEvent<WorkerResult>) => {
      const data = event.data
      const entry = pending.get(data.id)
      if (!entry) return
      pending.delete(data.id)
      if (
        data.ok &&
        data.full &&
        data.thumb &&
        data.fullContentType &&
        data.thumbContentType &&
        data.fullExt &&
        data.thumbExt
      ) {
        entry.resolve({
          full: data.full,
          thumb: data.thumb,
          fullContentType: data.fullContentType,
          thumbContentType: data.thumbContentType,
          fullExt: data.fullExt,
          thumbExt: data.thumbExt,
        })
      } else {
        entry.reject(new Error(data.error || "Image worker failed"))
      }
    }
    w.onerror = () => {
      workerUnavailable = true
      rejectAllPending(new Error("Image worker crashed"))
      try {
        w.terminate()
      } catch {
        /* ignore */
      }
      worker = null
    }
    worker = w
    return w
  } catch {
    workerUnavailable = true
    return null
  }
}

/**
 * Prepares a listing image pair in the worker. Resolves to `null` when no worker is available so
 * the caller can run the main-thread pipeline. Rejects only on genuine processing errors.
 */
export async function prepareListingImagePairInWorker(
  file: File,
  options?: PrepareListingImagePairOptions,
): Promise<PreparedListingImagePair | null> {
  const w = getWorker()
  if (!w) return null

  const id = nextRequestId++

  return new Promise<PreparedListingImagePair>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({
      id,
      file,
      type: file.type || "image/jpeg",
      rotate180: Boolean(options?.rotate180),
      fullMax: LISTING_FULL_MAX_LONG_EDGE,
      thumbMax: LISTING_THUMB_MAX_LONG_EDGE,
      qFull: LISTING_WEBP_QUALITY_FULL,
      qThumb: LISTING_WEBP_QUALITY_THUMB,
    })
  })
}
