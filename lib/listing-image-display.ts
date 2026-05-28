/**
 * - `listingCardImageSrc` — marketplace tiles (`ListingTile` and similar): prefer full `url`
 *   via same-origin `/media/listings/...` proxy; served with `unoptimized` to skip Vercel Image Optimization.
 * - `listingTileCarouselImageUrls` — ordered CDN URLs for multi-photo tiles (primary first).
 * - `listingTitleThumbnailSrc` — compact “thumb + title” rows (cart, checkout, orders):
 *   prefer `thumbnail_url` for bandwidth; fall back to `url`.
 * - `listingHeroSlideSrc` — large hero imagery: full `url` only.
 */

import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"

export type ListingImageForCard = {
  url?: string | null
  thumbnail_url?: string | null
  is_primary?: boolean | null
}

export function listingCardImageSrc(
  images: ListingImageForCard[] | null | undefined,
): string {
  const list = images ?? []
  const primary = list.find((i) => i.is_primary) || list[0]
  if (!primary) return ""
  const full = primary.url?.trim()
  if (full) return proxiedListingImageSrc(full)
  const thumb = primary.thumbnail_url?.trim()
  if (thumb) return proxiedListingImageSrc(thumb)
  return ""
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
    .map((img) => {
      const full = img.url?.trim()
      if (full) return proxiedListingImageSrc(full)
      const thumb = img.thumbnail_url?.trim()
      if (thumb) return proxiedListingImageSrc(thumb)
      return ""
    })
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
  const thumb = primary.thumbnail_url?.trim()
  if (thumb) return proxiedListingImageSrc(thumb)
  const full = primary.url?.trim()
  if (full) return proxiedListingImageSrc(full)
  return ""
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
