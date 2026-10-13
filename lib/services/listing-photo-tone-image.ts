import sharp from "sharp"
import {
  LISTING_CARD_MAX_LONG_EDGE,
  LISTING_FILM_MAX_LONG_EDGE,
  LISTING_FULL_MAX_LONG_EDGE,
  LISTING_THUMB_MAX_LONG_EDGE,
  LISTING_WEBP_QUALITY_CARD,
  LISTING_WEBP_QUALITY_FILM,
  LISTING_WEBP_QUALITY_FULL,
  LISTING_WEBP_QUALITY_THUMB,
} from "@/lib/listing-image-pipeline"
import {
  applyListingPhotoToneToPixels,
  type ListingPhotoTone,
} from "@/lib/utils/listing-photo-tone"

export type ListingPhotoToneDerivatives = {
  full: Buffer
  thumb: Buffer
  card: Buffer
  film: Buffer
}

function resizeWebp(input: Buffer, maxLongEdge: number, quality: number): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize(maxLongEdge, maxLongEdge, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: Math.round(quality * 100), effort: 4 })
    .toBuffer()
}

/**
 * Decode the unedited listing photo, apply tone once, and encode the full
 * object plus the thumb, card, and film derivatives the `/l` page serves.
 */
export async function renderListingPhotoToneDerivatives(
  input: Buffer,
  tone: ListingPhotoTone,
): Promise<ListingPhotoToneDerivatives> {
  const { data, info } = await sharp(input, { failOn: "none" })
    .rotate()
    .resize(LISTING_FULL_MAX_LONG_EDGE, LISTING_FULL_MAX_LONG_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  if (info.channels !== 3 || info.width < 1 || info.height < 1) {
    throw new Error("Could not read listing photo")
  }

  const pixels = new Uint8Array(data)
  applyListingPhotoToneToPixels(pixels, 3, tone)

  const full = await sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: 3 },
  })
    .webp({ quality: Math.round(LISTING_WEBP_QUALITY_FULL * 100), effort: 4 })
    .toBuffer()

  const [thumb, card, film] = await Promise.all([
    resizeWebp(full, LISTING_THUMB_MAX_LONG_EDGE, LISTING_WEBP_QUALITY_THUMB),
    resizeWebp(full, LISTING_CARD_MAX_LONG_EDGE, LISTING_WEBP_QUALITY_CARD),
    resizeWebp(full, LISTING_FILM_MAX_LONG_EDGE, LISTING_WEBP_QUALITY_FILM),
  ])

  return { full, thumb, card, film }
}
