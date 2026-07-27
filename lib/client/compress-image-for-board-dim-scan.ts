/**
 * Browser-only: shrink a sticker photo before POST /api/sell/scan-board-dims.
 * Targets ~1.2MB JPEG with max long edge 1600.
 */

const MAX_LONG_EDGE = 1600
const TARGET_MAX_BYTES = 1_200_000
const INITIAL_QUALITY = 0.84

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Couldn’t open that image. Try another photo."))
    }
    img.src = url
  })
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Couldn’t compress that image. Try another photo."))
          return
        }
        resolve(blob)
      },
      "image/jpeg",
      quality,
    )
  })
}

export async function compressImageForBoardDimScan(file: File): Promise<{
  base64: string
  mediaType: "image/jpeg"
  byteLength: number
}> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new Error("Choose a photo of the dimension sticker.")
  }

  const img = await loadImageFromFile(file)
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (!w || !h) {
    throw new Error("Couldn’t open that image. Try another photo.")
  }

  const longEdge = Math.max(w, h)
  const scale = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1
  const cw = Math.max(1, Math.round(w * scale))
  const ch = Math.max(1, Math.round(h * scale))

  const canvas = document.createElement("canvas")
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Couldn’t compress that image. Try another photo.")
  }
  ctx.drawImage(img, 0, 0, cw, ch)

  let quality = INITIAL_QUALITY
  let blob = await canvasToJpegBlob(canvas, quality)
  while (blob.size > TARGET_MAX_BYTES && quality > 0.5) {
    quality -= 0.08
    blob = await canvasToJpegBlob(canvas, quality)
  }

  if (blob.size > 1_500_000) {
    throw new Error("Image is still too large. Move closer to the sticker and try again.")
  }

  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }

  return {
    base64: btoa(binary),
    mediaType: "image/jpeg",
    byteLength: bytes.length,
  }
}
