import sharp from "sharp"

const MIN_BOX = 0.04
const MAX_PADDED = 1
const DEFAULT_PADDING = 0.12
const MIN_CROP_PX = 48
const MAX_CROP_BYTES = 8_000_000

export type StampCropBox = {
  x: number
  y: number
  width: number
  height: number
}

export function clampStampCropBox(raw: unknown): StampCropBox | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const x = asUnit(row.x)
  const y = asUnit(row.y)
  const width = asUnit(row.width)
  const height = asUnit(row.height)
  if (x == null || y == null || width == null || height == null) return null
  if (width < MIN_BOX || height < MIN_BOX) return null
  const clamped: StampCropBox = {
    x: Math.min(1 - MIN_BOX, Math.max(0, x)),
    y: Math.min(1 - MIN_BOX, Math.max(0, y)),
    width: Math.min(1, Math.max(MIN_BOX, width)),
    height: Math.min(1, Math.max(MIN_BOX, height)),
  }
  if (clamped.x + clamped.width > 1) clamped.width = 1 - clamped.x
  if (clamped.y + clamped.height > 1) clamped.height = 1 - clamped.y
  if (clamped.width < MIN_BOX || clamped.height < MIN_BOX) return null
  return clamped
}

function asUnit(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  if (!Number.isFinite(n)) return null
  return n
}

export function padStampCropBox(box: StampCropBox, padding = DEFAULT_PADDING): StampCropBox {
  const padX = box.width * padding
  const padY = box.height * padding
  const x = Math.max(0, box.x - padX)
  const y = Math.max(0, box.y - padY)
  const right = Math.min(MAX_PADDED, box.x + box.width + padX)
  const bottom = Math.min(MAX_PADDED, box.y + box.height + padY)
  return {
    x,
    y,
    width: Math.max(MIN_BOX, right - x),
    height: Math.max(MIN_BOX, bottom - y),
  }
}

/**
 * Crop a listing photo to the stamp region. Returns null when the box is
 * unusable or the crop would be tiny — caller should OCR the full frame.
 */
export async function cropStampPhotoForVision(
  bytes: Uint8Array,
  box: StampCropBox,
): Promise<{ bytes: Uint8Array; mediaType: "image/jpeg" } | null> {
  if (bytes.byteLength < 256) return null
  const padded = padStampCropBox(box)
  try {
    const image = sharp(Buffer.from(bytes), { failOn: "none" }).rotate()
    const meta = await image.metadata()
    const width = meta.width ?? 0
    const height = meta.height ?? 0
    if (width < MIN_CROP_PX || height < MIN_CROP_PX) return null

    const left = Math.max(0, Math.round(padded.x * width))
    const top = Math.max(0, Math.round(padded.y * height))
    const cropWidth = Math.min(width - left, Math.round(padded.width * width))
    const cropHeight = Math.min(height - top, Math.round(padded.height * height))
    if (cropWidth < MIN_CROP_PX || cropHeight < MIN_CROP_PX) return null

    const out = await image
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer()

    if (out.byteLength < 256 || out.byteLength > MAX_CROP_BYTES) return null
    return { bytes: new Uint8Array(out), mediaType: "image/jpeg" }
  } catch {
    return null
  }
}
