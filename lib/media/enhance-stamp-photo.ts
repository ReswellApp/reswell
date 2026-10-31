import "server-only"

import sharp from "sharp"

/**
 * Stamp / handwriting OCR preprocess for vision.
 * Boosts faint stringer ink and low-contrast labels without inventing pixels.
 */
export async function enhanceStampPhotoForVision(
  bytes: Uint8Array,
): Promise<{ bytes: Uint8Array; mediaType: "image/jpeg" } | null> {
  if (bytes.byteLength < 256) return null
  try {
    const out = await sharp(Buffer.from(bytes), { failOn: "none" })
      .rotate()
      // Stretch tonal range so washed-out ink separates from foam/resin.
      .normalize()
      // Slightly lift midtones; ease saturation so ink edges dominate.
      .modulate({ brightness: 1.1, saturation: 0.85 })
      // Contrast: slope > 1 around mid-gray.
      .linear(1.35, -(128 * 0.35))
      .sharpen({ sigma: 1.4, m1: 1.2, m2: 0.6 })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer()

    if (out.byteLength < 256 || out.byteLength > 8_000_000) return null
    return { bytes: new Uint8Array(out), mediaType: "image/jpeg" }
  } catch {
    return null
  }
}
