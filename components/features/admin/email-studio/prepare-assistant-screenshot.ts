import {
  ASSISTANT_SCREENSHOT_MAX_BYTES,
  ASSISTANT_SCREENSHOT_MEDIA_TYPES,
} from "@/lib/email-studio/assistant-images"

const SCREENSHOT_EXTENSION = /\.(png|jpe?g|webp|gif)$/i
const MAX_SOURCE_BYTES = 15 * 1024 * 1024
const MAX_EDGE = 1600
const TARGET_BYTES = 700_000

export interface PreparedAssistantScreenshot {
  mediaType: "image/jpeg"
  dataBase64: string
  previewUrl: string
}

function isScreenshotFile(file: File): boolean {
  return (
    ASSISTANT_SCREENSHOT_MEDIA_TYPES.some((type) => type === file.type)
    || SCREENSHOT_EXTENSION.test(file.name)
  )
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality)
  })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read that image."))
        return
      }
      const comma = reader.result.indexOf(",")
      resolve(comma === -1 ? reader.result : reader.result.slice(comma + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that image."))
    reader.readAsDataURL(blob)
  })
}

/** Shrink a dropped screenshot to a jpeg the assistant action can carry. */
export async function prepareAssistantScreenshot(
  file: File,
): Promise<PreparedAssistantScreenshot | { error: string }> {
  if (!isScreenshotFile(file)) {
    return { error: "Drop a PNG, JPG, WebP, or GIF screenshot." }
  }
  if (file.size < 1 || file.size > MAX_SOURCE_BYTES) {
    return { error: "That screenshot is too large. Use one under 15 MB." }
  }

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap || bitmap.width < 1 || bitmap.height < 1) {
    return { error: "Could not read that image." }
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) {
    bitmap.close()
    return { error: "Could not read that image." }
  }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  let quality = 0.82
  let blob = await canvasToJpeg(canvas, quality)
  while (blob && blob.size > TARGET_BYTES && quality > 0.5) {
    quality = Math.round((quality - 0.08) * 100) / 100
    blob = await canvasToJpeg(canvas, quality)
  }
  if (!blob || blob.size > ASSISTANT_SCREENSHOT_MAX_BYTES) {
    return { error: "That screenshot is still too large after compressing. Try a smaller crop." }
  }

  try {
    const dataBase64 = await blobToBase64(blob)
    return {
      mediaType: "image/jpeg",
      dataBase64,
      previewUrl: URL.createObjectURL(blob),
    }
  } catch {
    return { error: "Could not read that image." }
  }
}
