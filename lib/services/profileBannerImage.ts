import sharp from "sharp"
import { decodeImageBufferForSharp } from "@/lib/services/decodeImageForSharp"

const BANNER_WIDTH_PX = 1600
const BANNER_HEIGHT_PX = 400

/**
 * Stores the banner source without a hard crop so users can adjust focal point in the UI.
 * Caps longest edge; preserves aspect ratio.
 */
export async function processProfileBannerSourceToWebp(
  input: Buffer,
  opts: { originalFilename: string; mimeType: string },
): Promise<Buffer> {
  const decoded = await decodeImageBufferForSharp(input, opts)
  const meta = await sharp(decoded, { failOn: "none" }).rotate().metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const maxEdge = Math.max(width, height)

  const MAX_LONG_EDGE_PX = 3200
  const MIN_LONG_EDGE_PX = 1200

  let pipeline = sharp(decoded, { failOn: "none" }).rotate()

  if (maxEdge > MAX_LONG_EDGE_PX) {
    pipeline = pipeline.resize(MAX_LONG_EDGE_PX, MAX_LONG_EDGE_PX, {
      fit: "inside",
      withoutEnlargement: true,
    })
  } else if (maxEdge > 0 && maxEdge < MIN_LONG_EDGE_PX) {
    pipeline = pipeline.resize(MIN_LONG_EDGE_PX, MIN_LONG_EDGE_PX, {
      fit: "inside",
    })
  }

  return pipeline.webp({ quality: 88, effort: 4 }).toBuffer()
}

/**
 * Legacy center-crop export — kept for reference; uploads now use {@link processProfileBannerSourceToWebp}.
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
