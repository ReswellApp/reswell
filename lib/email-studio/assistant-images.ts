export const ASSISTANT_SCREENSHOT_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const

export type AssistantScreenshotMediaType = (typeof ASSISTANT_SCREENSHOT_MEDIA_TYPES)[number]

export const ASSISTANT_SCREENSHOT_MAX_COUNT = 3
export const ASSISTANT_SCREENSHOT_MAX_BYTES = 900_000
export const ASSISTANT_SCREENSHOT_MAX_TOTAL_BYTES = 2_200_000
/** Base64 length cap for one image, including padding. */
export const ASSISTANT_SCREENSHOT_MAX_BASE64_CHARS = 1_250_000

export interface AssistantScreenshot {
  mediaType: AssistantScreenshotMediaType
  bytes: Uint8Array
}

export function assistantScreenshotRequest(scope: "email" | "flow", message: string): string {
  const trimmed = message.trim()
  if (trimmed) return trimmed
  return scope === "email"
    ? "Rebuild this email from the attached screenshot."
    : "Build this flow from the attached screenshot."
}

export function assistantScreenshotInstruction(count: number): string | null {
  if (count < 1) return null
  const images = count === 1 ? "One screenshot is attached. It is" : `${count} screenshots are attached. They are`
  return `${images} the design reference. Study the layout, sections, columns, imagery, and readable copy, then build that design. When a screenshot shows a whole email, use replace-document. Leave image src empty; the screenshot is a reference, not an asset to embed. Only screenshots on this message are visible.`
}

export function assistantTranscriptContent(message: string, imageCount: number): string {
  const body = message.trim()
  if (imageCount < 1) return body
  const note = imageCount === 1 ? "Screenshot attached." : `${imageCount} screenshots attached.`
  return body ? `${body}\n\n${note}` : note
}

function sniffAssistantScreenshot(bytes: Uint8Array): AssistantScreenshotMediaType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return "image/png"
  }
  if (
    bytes.length >= 6
    && bytes[0] === 0x47
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x38
  ) {
    return "image/gif"
  }
  if (
    bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    return "image/webp"
  }
  return null
}

function decodeBase64(value: string): Uint8Array | null {
  const cleaned = value.trim().replace(/^data:[^,]*,/, "").replace(/\s/g, "")
  if (cleaned.length < 8 || cleaned.length % 4 === 1) return null
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) return null
  const padded = cleaned.padEnd(cleaned.length + ((4 - (cleaned.length % 4)) % 4), "=")
  try {
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes.byteLength > 0 ? bytes : null
  } catch {
    return null
  }
}

export function decodeAssistantScreenshots(
  images: { mediaType: string; dataBase64: string }[] | undefined,
): { ok: true; images: AssistantScreenshot[] } | { ok: false; error: string } {
  const list = images ?? []
  if (list.length > ASSISTANT_SCREENSHOT_MAX_COUNT) {
    return { ok: false, error: "Attach up to 3 screenshots." }
  }
  const decoded: AssistantScreenshot[] = []
  let total = 0
  for (const image of list) {
    const bytes = decodeBase64(image.dataBase64)
    if (!bytes || bytes.byteLength < 24) {
      return { ok: false, error: "That screenshot could not be read. Drop a PNG or JPG." }
    }
    total += bytes.byteLength
    if (bytes.byteLength > ASSISTANT_SCREENSHOT_MAX_BYTES || total > ASSISTANT_SCREENSHOT_MAX_TOTAL_BYTES) {
      return { ok: false, error: "That screenshot is too large. Crop it and try again." }
    }
    const mediaType = sniffAssistantScreenshot(bytes)
    if (!mediaType) {
      return { ok: false, error: "Use a PNG, JPG, WebP, or GIF screenshot." }
    }
    decoded.push({ mediaType, bytes })
  }
  return { ok: true, images: decoded }
}
