/**
 * - `listingTileImageSrcFromRow` — single image row for browse tiles: stored thumb first,
 *   then derived `-thumb.` sibling, then on-demand `?variant=tile` resize for legacy full-res.
 * - `listingCardImageSrc` — primary photo for marketplace tiles (`ListingTile` and similar).
 * - `listingTileCarouselImageUrls` — ordered CDN URLs for multi-photo tiles (primary first).
 * - `listingTitleThumbnailSrc` — compact “thumb + title” rows (cart, checkout, orders).
 * - `listingHeroSlideSrc` — large hero imagery: full `url` only.
 */

import {
  proxiedListingImageSrc,
  withListingMediaTileVariant,
} from "@/lib/listing-media-proxy-url"

export type ListingImageForCard = {
  url?: string | null
  thumbnail_url?: string | null
  is_primary?: boolean | null
}

/** When `thumbnail_url` was never persisted, pair uploads still store `*-thumb.webp` beside `*-full.*`. */
function derivedListingThumbUrlFromFullUrl(fullUrl: string): string | null {
  const t = fullUrl.trim()
  if (!t.includes("-full.")) return null
  return t.replace("-full.", "-thumb.")
}

/**
 * Best src for a listing photo in browse grids / carousels — never returns an unscaled full-res
 * proxy unless `?variant=tile` is appended for server-side resize.
 */
export function listingTileImageSrcFromRow(img: ListingImageForCard): string {
  const thumb = img.thumbnail_url?.trim()
  if (thumb) return proxiedListingImageSrc(thumb)

  const full = img.url?.trim()
  if (!full) return ""

  const derivedThumb = derivedListingThumbUrlFromFullUrl(full)
  if (derivedThumb) return proxiedListingImageSrc(derivedThumb)

  return withListingMediaTileVariant(proxiedListingImageSrc(full))
}

export function listingCardImageSrc(
  images: ListingImageForCard[] | null | undefined,
): string {
  const list = images ?? []
  const primary = list.find((i) => i.is_primary) || list[0]
  if (!primary) return ""
  return listingTileImageSrcFromRow(primary)
}

/** All listing photos for carousel tiles: primary first, then remaining images in original order. */
export function listingTileCarouselImageUrls(
  images: ListingImageForCard[] | null | undefined,
): string[] {
  const list = images ?? []
  if (list.length === 0) return []

  const primaryIdx = list.findIndex((i) => i.is_primary)
  const ordered =
    primaryIdx <= 0
      ? [...list]
      : [list[primaryIdx]!, ...list.filter((_, i) => i !== primaryIdx)]

  return ordered
    .map((img) => listingTileImageSrcFromRow(img))
    .filter((url): url is string => url.length > 0)
}

/**
 * Compact rows (cart, checkout summary, order lists, nav search): prefer stored
 * `thumbnail_url` for bandwidth; fall back to full `url` when missing.
 */
export function listingTitleThumbnailSrc(
  images: ListingImageForCard[] | null | undefined,
): string {
  const list = images ?? []
  const primary = list.find((i) => i.is_primary) || list[0]
  if (!primary) return ""
  return listingTileImageSrcFromRow(primary)
}

/** Full-size primary image for large backdrops (e.g. homepage hero); skips thumbnails. */
export function listingHeroSlideSrc(
  images: ListingImageForCard[] | null | undefined,
): string | null {
  const list = images ?? []
  const primary = list.find((i) => i.is_primary) || list[0]
  const raw = primary?.url?.trim()
  if (!raw) return null
  const proxied = proxiedListingImageSrc(raw)
  return proxied || null
}
