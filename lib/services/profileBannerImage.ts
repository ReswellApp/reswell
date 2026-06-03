import sharp from "sharp"
import { decodeImageBufferForSharp } from "@/lib/services/decodeImageForSharp"

const BANNER_WIDTH_PX = 1600
const BANNER_HEIGHT_PX = 400

/**
 * Scales uniformly, center-crops to a wide banner, then encodes WebP for seller profile headers.
 */
export async function processProfileBannerToWebp(
  input: Buffer,
  opts: { originalFilename: string; mimeType: string },
): Promise<Buffer> {
  const decoded = await decodeImageBufferForSharp(input, opts)

  return sharp(decoded, { failOn: "none" })
    .rotate()
    .resize(BANNER_WIDTH_PX, BANNER_HEIGHT_PX, {
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .webp({ quality: 85, effort: 4 })
    .toBuffer()
}
