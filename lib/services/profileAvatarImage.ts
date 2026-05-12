import sharp from "sharp"
import { decodeImageBufferForSharp } from "@/lib/services/decodeImageForSharp"

/** Stored square edge length; UI uses a circle with `object-cover` (uniform scale + crop). */
const AVATAR_EDGE_PX = 512

/**
 * Scales uniformly (no stretch), center-crops to a square with saliency-aware crop,
 * then encodes WebP — matches circular `object-cover` display without distortion.
 */
export async function processProfileAvatarToWebp(
  input: Buffer,
  opts: { originalFilename: string; mimeType: string },
): Promise<Buffer> {
  const decoded = await decodeImageBufferForSharp(input, opts)

  return sharp(decoded, { failOn: "none" })
    .rotate()
    .resize(AVATAR_EDGE_PX, AVATAR_EDGE_PX, {
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .webp({ quality: 88, effort: 4 })
    .toBuffer()
}
