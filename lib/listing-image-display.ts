/**
 * Prefer stored thumbnail for browse UIs; fall back to full `url` (legacy rows).
 * Detail / lightbox views should use `url` only.
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
  if (!primary?.url) return ""
  const thumb = primary.thumbnail_url?.trim()
  const raw = thumb || primary.url.trim()
  return proxiedListingImageSrc(raw)
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
