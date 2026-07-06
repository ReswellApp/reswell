import sharp from "sharp"
import { decodeImageBufferForSharp } from "@/lib/services/decodeImageForSharp"

/**
 * Stores the avatar source without a hard crop so users can adjust focal point in the UI.
 * Caps longest edge; preserves aspect ratio.
 */
export async function processProfileAvatarSourceToWebp(
  input: Buffer,
  opts: { originalFilename: string; mimeType: string },
): Promise<Buffer> {
  const decoded = await decodeImageBufferForSharp(input, opts)
  const meta = await sharp(decoded, { failOn: "none" }).rotate().metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const maxEdge = Math.max(width, height)

  const MAX_LONG_EDGE_PX = 1600
  const MIN_LONG_EDGE_PX = 512

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

  const sizedMeta = await pipeline.metadata()
  const sizedWidth = sizedMeta.width ?? 0
  const sizedHeight = sizedMeta.height ?? 0
  if (sizedWidth > 0 && sizedHeight > 0) {
    const ratio = sizedWidth / sizedHeight
    // Square-ish sources have no object-cover slack in a circular crop — add edge padding.
    if (ratio >= 0.9 && ratio <= 1.11) {
      const pad = Math.max(16, Math.round(Math.max(sizedWidth, sizedHeight) * 0.12))
      pipeline = pipeline.extend({
        top: pad,
        bottom: pad,
        left: pad,
        right: pad,
        extend: {
          top: pad,
          bottom: pad,
          left: pad,
          right: pad,
        },
      })
    }
  }

  return pipeline.webp({ quality: 88, effort: 4 }).toBuffer()
}

/** @deprecated Uploads now use {@link processProfileAvatarSourceToWebp}. */
export async function processProfileAvatarToWebp(
  input: Buffer,
  opts: { originalFilename: string; mimeType: string },
): Promise<Buffer> {
  return processProfileAvatarSourceToWebp(input, opts)
}
