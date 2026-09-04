/**
 * - `listingTileImageSrcFromRow` — single image row for browse tiles: persisted thumb first
 *   (only when it is distinct from the full URL), then on-demand `?variant=tile` resize.
 *   Does not guess `*-thumb.` siblings — those 404s serialized every card on first paint.
 * - `listingCardImageSrc` — primary photo for marketplace tiles (`ListingTile` and similar).
 * - `listingTileCarouselImageUrls` — ordered CDN URLs for multi-photo tiles (primary first).
 * - `listingTitleThumbnailSrc` — compact “thumb + title” rows (cart, checkout, orders).
 * - `listingHeroSlideSrc` — large hero imagery: full `url` only.
 */

import {
  proxiedListingImageSrc,
  withListingMediaTileVariant,
} from "@/lib/listing-media-proxy-url"
import { listingStoredThumbIsDistinctFromFull } from "@/lib/listing-thumb-url"

export type ListingImageForCard = {
  url?: string | null
  thumbnail_url?: string | null
  is_primary?: boolean | null
}

function pushUniqueCandidate(out: string[], seen: Set<string>, candidate: string): void {
  const t = candidate.trim()
  if (!t || seen.has(t)) return
  seen.add(t)
  out.push(t)
}

/** Ordered fallbacks for one listing photo — persisted thumb, resized full, then raw full. */
export function listingTileImageSrcCandidatesFromRow(img: ListingImageForCard): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  const storedThumb = img.thumbnail_url?.trim() || ""
  const full = img.url?.trim() || ""
  // Imports used to copy the full URL into thumbnail_url. That is not a thumb —
  // skip it so we hit `?variant=tile` instead of downloading the original first.
  if (listingStoredThumbIsDistinctFromFull(storedThumb, full)) {
    pushUniqueCandidate(out, seen, proxiedListingImageSrc(storedThumb))
  }

  if (!full) return out

  const proxiedFull = proxiedListingImageSrc(full)
  if (proxiedFull.startsWith("/media/listings/")) {
    pushUniqueCandidate(out, seen, withListingMediaTileVariant(proxiedFull))
  }
  pushUniqueCandidate(out, seen, proxiedFull)
  if (!proxiedFull.startsWith("/media/listings/")) {
    pushUniqueCandidate(out, seen, full)
  }

  return out
}

/**
 * Best src for a listing photo in browse grids / carousels — never returns an unscaled full-res
 * proxy unless `?variant=tile` is appended for server-side resize.
 */
export function listingTileImageSrcFromRow(img: ListingImageForCard): string {
  return listingTileImageSrcCandidatesFromRow(img)[0] ?? ""
}

export function listingCardImageSrc(
  images: ListingImageForCard[] | null | undefined,
): string {
  const list = images ?? []
  const primary = list.find((i) => i.is_primary) || list[0]
  if (!primary) return ""
  return listingTileImageSrcFromRow(primary)
}

/**
 * Build a one-element `listing_images` array from denormalized cover columns on
 * `listings`. Used by card/browse selects that skip the listing_images join.
 */
export function listingImagesFromPrimaryFields(
  primaryImageUrl: string | null | undefined,
  primaryThumbnailUrl: string | null | undefined,
): ListingImageForCard[] | null {
  const url = typeof primaryImageUrl === "string" ? primaryImageUrl.trim() : ""
  if (!url) return null
  const thumb =
    typeof primaryThumbnailUrl === "string" && primaryThumbnailUrl.trim()
      ? primaryThumbnailUrl.trim()
      : null
  return [{ url, thumbnail_url: thumb, is_primary: true }]
}

/** Prefer nested images when present; otherwise use denormalized primary columns. */
export function coalesceListingImagesForCard(row: {
  listing_images?: ListingImageForCard[] | null
  primary_image_url?: string | null
  primary_thumbnail_url?: string | null
}): ListingImageForCard[] | null {
  if (Array.isArray(row.listing_images) && row.listing_images.length > 0) {
    return row.listing_images
  }
  return listingImagesFromPrimaryFields(row.primary_image_url, row.primary_thumbnail_url)
}

/** Attach `listing_images` for card UIs after a denorm-only select. */
export function hydrateCardListingImages<
  T extends {
    listing_images?: ListingImageForCard[] | null
    primary_image_url?: string | null
    primary_thumbnail_url?: string | null
  },
>(rows: T[]): Array<T & { listing_images: ListingImageForCard[] | null }> {
  return rows.map((row) => ({
    ...row,
    listing_images: coalesceListingImagesForCard(row),
  }))
}

/** All listing photos for carousel tiles: primary first, then remaining images in original order. */
export function listingTileCarouselImageUrls(
  images: ListingImageForCard[] | null | undefined,
): string[] {
  return listingTileCarouselImageCandidateLists(images).map((candidates) => candidates[0] ?? "").filter(Boolean)
}

/** Per-slide URL fallbacks for carousel tiles (primary photo first). */
export function listingTileCarouselImageCandidateLists(
  images: ListingImageForCard[] | null | undefined,
): string[][] {
  const list = images ?? []
  if (list.length === 0) return []

  const primaryIdx = list.findIndex((i) => i.is_primary)
  const ordered =
    primaryIdx <= 0
      ? [...list]
      : [list[primaryIdx]!, ...list.filter((_, i) => i !== primaryIdx)]

  return ordered
    .map((img) => listingTileImageSrcCandidatesFromRow(img))
    .filter((candidates) => candidates.length > 0)
}

/** Ordered fallbacks for compact listing rows (nav search, cart, checkout). */
export function listingTitleThumbnailCandidates(
  images: ListingImageForCard[] | null | undefined,
): string[] {
  const list = images ?? []
  const primary = list.find((i) => i.is_primary) || list[0]
  if (!primary) return []
  return listingTileImageSrcCandidatesFromRow(primary)
}

/**
 * Compact rows (cart, checkout summary, order lists, nav search): prefer stored
 * `thumbnail_url` for bandwidth; fall back to full `url` when missing.
 */
export function listingTitleThumbnailSrc(
  images: ListingImageForCard[] | null | undefined,
): string {
  return listingTitleThumbnailCandidates(images)[0] ?? ""
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
