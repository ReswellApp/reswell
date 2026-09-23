"use client"

import { ensureBrowserDecodableImageFile } from "@/lib/client-image-decode"
import { SERVER_IMAGE_CONVERT_MAX_BYTES } from "@/lib/utils/server-image-convert"

const SCAN_MAX_LONG_EDGE = 1280
const SCAN_JPEG_QUALITY = 0.82

function longEdgeSize(width: number, height: number): { width: number; height: number } {
  const long = Math.max(width, height)
  if (long <= SCAN_MAX_LONG_EDGE) return { width, height }
  const scale = SCAN_MAX_LONG_EDGE / long
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function blobToJpegFile(blob: Blob, name: string): Promise<File> {
  const base = name.replace(/\.[^.]+$/i, "") || "scan"
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" })
}

/**
 * Decode and downscale a photo so the admin scan upload stays under the
 * serverless body limit and is cheap for the vision model.
 */
export async function prepareSellCatalogScanImage(file: File): Promise<File> {
  const decodable = await ensureBrowserDecodableImageFile(file)
  const bitmap = await createImageBitmap(decodable, { imageOrientation: "from-image" })
  try {
    const { width, height } = longEdgeSize(bitmap.width, bitmap.height)
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Could not prepare this photo.")
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (next) => {
          if (!next) {
            reject(new Error("Could not prepare this photo."))
            return
          }
          resolve(next)
        },
        "image/jpeg",
        SCAN_JPEG_QUALITY,
      )
    })

    if (blob.size > SERVER_IMAGE_CONVERT_MAX_BYTES) {
      throw new Error("This photo is still too large after shrinking. Try a closer crop.")
    }

    return blobToJpegFile(blob, file.name)
  } finally {
    bitmap.close()
  }
}
