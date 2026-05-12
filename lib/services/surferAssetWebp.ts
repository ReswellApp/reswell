import sharp from "sharp"
import { decodeImageBufferForSharp } from "@/lib/services/decodeImageForSharp"
import { SURFER_ASSET_STORED_MAX_BYTES } from "@/lib/surfers/surfer-asset-limits"
import { normalizeSurferImageQuarterTurns } from "@/lib/surfers/surfer-image-quarter-turns"

const WEBP_STEPS: { maxEdge: number; quality: number }[] = [
  { maxEdge: 4096, quality: 90 },
  { maxEdge: 3072, quality: 88 },
  { maxEdge: 2560, quality: 85 },
  { maxEdge: 2048, quality: 82 },
  { maxEdge: 1920, quality: 80 },
  { maxEdge: 1600, quality: 78 },
  { maxEdge: 1280, quality: 75 },
  { maxEdge: 1024, quality: 72 },
]

export type SurferAssetWebpInputMeta = {
  originalFilename: string
  mimeType: string
  /** Clockwise quarter-turns after EXIF auto-orientation (0–3). */
  rotateQuarterTurns?: number
}

/** Raster image → WebP, sized to fit {@link SURFER_ASSET_STORED_MAX_BYTES}. */
export async function convertSurferAssetUploadToWebp(
  input: Buffer,
  opts: SurferAssetWebpInputMeta,
): Promise<Buffer> {
  const decoded = await decodeImageBufferForSharp(input, opts)
  const quarter = normalizeSurferImageQuarterTurns(opts.rotateQuarterTurns ?? 0)
  const extraDegrees = quarter * 90

  let lastErr: unknown = null
  for (const { maxEdge, quality } of WEBP_STEPS) {
    try {
      let pipeline = sharp(decoded, { failOn: "none" }).rotate()
      if (extraDegrees % 360 !== 0) {
        pipeline = pipeline.rotate(extraDegrees)
      }
      const buf = await pipeline
        .resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toBuffer()
      if (buf.length <= SURFER_ASSET_STORED_MAX_BYTES) {
        return buf
      }
    } catch (e) {
      lastErr = e
    }
  }

  if (lastErr instanceof Error) {
    throw new Error(`${lastErr.message} Try another format or a smaller file.`)
  }

  throw new Error(
    `Could not produce a WebP under the ${SURFER_ASSET_STORED_MAX_BYTES / (1024 * 1024)}MB storage limit. Try a smaller image.`,
  )
}
