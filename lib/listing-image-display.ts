/**
 * Prefer stored thumbnail for browse UIs; fall back to full `url` (legacy rows).
 * Detail / lightbox views should use `url` only.
 */

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
  if (thumb) return thumb
  return primary.url.trim()
}
