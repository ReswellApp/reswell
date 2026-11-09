import sharp from "sharp"
import type { ListingPhotoQuarterTurnDelta } from "@/lib/sell-flow/listing-photo-orientation"

/**
 * Match the sell uploader in `lib/listing-image-pipeline.ts`.
 * Kept here so a server rotate does not import the browser encoder.
 */
const FULL_MAX_LONG_EDGE = 2000
const THUMB_MAX_LONG_EDGE = 640
const CARD_MAX_LONG_EDGE = 960
const FILM_MAX_LONG_EDGE = 400
const FULL_QUALITY = 0.82
const THUMB_QUALITY = 0.74
const CARD_QUALITY = 0.85
const FILM_QUALITY = 0.82

export type RotatedListingDerivatives = {
  full: Buffer
  thumb: Buffer
  card: Buffer
  film: Buffer
}

async function renderRotatedWebp(
  input: Buffer,
  quarterTurns: ListingPhotoQuarterTurnDelta,
  maxLongEdge: number,
  quality: number,
): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .rotate()
    .rotate(quarterTurns * 90)
    .resize(maxLongEdge, maxLongEdge, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: Math.round(quality * 100), effort: 4 })
    .toBuffer()
}

/**
 * Applies leftover camera EXIF, then turns the pixels clockwise.
 * Writes the same full / thumb / card / film set the sell uploader stores.
 */
export async function renderRotatedListingDerivatives(
  input: Buffer,
  quarterTurns: ListingPhotoQuarterTurnDelta,
): Promise<RotatedListingDerivatives> {
  const [full, thumb, card, film] = await Promise.all([
    renderRotatedWebp(input, quarterTurns, FULL_MAX_LONG_EDGE, FULL_QUALITY),
    renderRotatedWebp(input, quarterTurns, THUMB_MAX_LONG_EDGE, THUMB_QUALITY),
    renderRotatedWebp(input, quarterTurns, CARD_MAX_LONG_EDGE, CARD_QUALITY),
    renderRotatedWebp(input, quarterTurns, FILM_MAX_LONG_EDGE, FILM_QUALITY),
  ])
  return { full, thumb, card, film }
}
