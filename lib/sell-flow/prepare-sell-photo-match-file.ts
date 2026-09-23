import { createImageBitmapMaxLongEdge } from "@/lib/listing-image-pipeline"
import { SELL_PHOTO_MATCH_MAX_BYTES } from "@/lib/sell-flow/sell-photo-match"

const MAX_EDGE = 1280
const JPEG_QUALITY = 0.82
const JPEG_QUALITY_RETRY = 0.62

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size < 1) {
          reject(new Error("Could not encode that photo."))
          return
        }
        resolve(blob)
      },
      "image/jpeg",
      quality,
    )
  })
}

/** Downscale a camera or library photo to a JPEG the photo-match route will accept. */
export async function prepareSellPhotoMatchFile(file: File): Promise<File> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmapMaxLongEdge(file, MAX_EDGE)
  } catch {
    throw new Error("This photo format couldn’t be read. Take the photo here, or upload a JPEG or PNG.")
  }

  try {
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, bitmap.width)
    canvas.height = Math.max(1, bitmap.height)
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Could not prepare that photo.")
    ctx.drawImage(bitmap, 0, 0)
    let blob = await canvasToJpeg(canvas, JPEG_QUALITY)
    if (blob.size > SELL_PHOTO_MATCH_MAX_BYTES) {
      blob = await canvasToJpeg(canvas, JPEG_QUALITY_RETRY)
    }
    if (blob.size > SELL_PHOTO_MATCH_MAX_BYTES) {
      throw new Error("That photo is too large. Try a closer crop.")
    }
    return new File([blob], "photo.jpg", { type: "image/jpeg" })
  } finally {
    bitmap.close()
  }
}
