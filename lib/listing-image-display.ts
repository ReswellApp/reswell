/**
 * - `listingTileImageSrcFromRow` — marketplace cards: on-demand `?variant=tile2` from the
 *   full object (≤1280px WebP). Skips stored 640px thumbs so retina tiles are not upscaled.
 *   Does not guess `*-thumb.` siblings — those 404s serialized every card on first paint.
 * - `listingCardImageSrc` — primary photo for marketplace tiles (`ListingTile` and similar).
 * - `listingImagesFromPrimaryFields` — card gallery from denorm cover + `tile_gallery_images`.
 * - `listingTileCarouselImageUrls` — ordered CDN URLs for multi-photo tiles (primary first).
 * - `listingTitleThumbnailSrc` — compact “thumb + title” rows (cart, checkout, orders).
 * - `listingHeroSlideSrc` — large hero imagery: full `url` only.
 */

import {
  listingFullImageUrlFromRef,
  proxiedListingImageSrc,
  withListingMediaTileVariant,
} from "./listing-media-src.ts"
import { listingStoredThumbIsDistinctFromFull } from "./listing-thumb-url.ts"

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

function listingFullObjectSrcCandidates(full: string, out: string[], seen: Set<string>): void {
  const proxiedFull = proxiedListingImageSrc(full)
  if (proxiedFull.startsWith("/media/listings/")) {
    // Never start from `-thumb.` — /media serves stored thumbs as-is even with ?variant=tile2.
    pushUniqueCandidate(out, seen, withListingMediaTileVariant(proxiedFull))
  }
  pushUniqueCandidate(out, seen, proxiedFull)
  if (!proxiedFull.startsWith("/media/listings/")) {
    pushUniqueCandidate(out, seen, full)
  }
}

/** Ordered fallbacks for one listing photo — resized full first, then raw full. */
export function listingTileImageSrcCandidatesFromRow(img: ListingImageForCard): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  const storedThumb = img.thumbnail_url?.trim() || ""
  const fullRaw = img.url?.trim() || ""
  const full = listingFullImageUrlFromRef(fullRaw) ?? fullRaw

  if (full) {
    listingFullObjectSrcCandidates(full, out, seen)
    return out
  }

  if (listingStoredThumbIsDistinctFromFull(storedThumb, fullRaw)) {
    pushUniqueCandidate(out, seen, proxiedListingImageSrc(storedThumb))
  }

  return out
}

/**
 * Best src for a listing photo in browse grids / carousels — `?variant=tile2` from the full
 * object. Never leads with a stored 640px thumb.
 */
export function listingTileImageSrcFromRow(img: ListingImageForCard): string {
  return listingTileImageSrcCandidatesFromRow(img)[0] ?? ""
}

/**
 * PostgREST embeds are arrays on success. A failed embed can arrive as an error
 * object (`{ message, code }`) — never call `.find` / `.sort` on that value.
 */
export function asListingImageArray(
  images: ListingImageForCard[] | ListingImageForCard | null | undefined | unknown,
): ListingImageForCard[] {
  if (Array.isArray(images)) {
    return images.filter((img): img is ListingImageForCard => !!img && typeof img === "object")
  }
  if (images && typeof images === "object" && "url" in images) {
    return [images as ListingImageForCard]
  }
  return []
}

/** Gallery order: primary first, then `sort_order`. Does not mutate the source. */
export function orderedListingGalleryImages<T extends ListingImageForCard>(
  images: T[] | null | undefined | unknown,
): T[] {
  const list = asListingImageArray(images) as T[]
  return [...list].sort((a, b) => {
    const aOrder = (a as ListingImageForCard & { sort_order?: number | null }).sort_order
    const bOrder = (b as ListingImageForCard & { sort_order?: number | null }).sort_order
    return (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (aOrder ?? 0) - (bOrder ?? 0)
  })
}

export function listingCardImageSrc(
  images: ListingImageForCard[] | ListingImageForCard | null | undefined | unknown,
): string {
  const list = asListingImageArray(images)
  const primary = list.find((i) => i.is_primary) || list[0]
  if (!primary) return ""
  return listingTileImageSrcFromRow(primary)
}

/** Matches `listings.tile_gallery_images` trigger cap — keep in sync with the SQL function. */
export const LISTING_TILE_GALLERY_MAX_IMAGES = 12

/** PostgREST listing columns for card carousels — no `listing_images` join. */
export const LISTING_CARD_IMAGE_COLUMNS = `
  primary_image_url,
  primary_thumbnail_url,
  tile_gallery_images`

export type ListingTileGalleryImage = {
  url: string
  thumbnail_url?: string | null
}

function asTileGalleryImages(value: unknown): ListingImageForCard[] {
  if (!Array.isArray(value)) return []
  const out: ListingImageForCard[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const rawUrl = (item as { url?: unknown }).url
    const url = typeof rawUrl === "string" ? rawUrl.trim() : ""
    if (!url) continue
    const rawThumb = (item as { thumbnail_url?: unknown }).thumbnail_url
    const thumbnail_url =
      typeof rawThumb === "string" && rawThumb.trim() ? rawThumb.trim() : null
    out.push({
      url,
      thumbnail_url,
      is_primary: out.length === 0,
    })
    if (out.length >= LISTING_TILE_GALLERY_MAX_IMAGES) break
  }
  return out
}

/**
 * Build a card `listing_images` array from denormalized cover columns on
 * `listings`. Prefers `tile_gallery_images` (capped carousel) so tiles can
 * page photos without a listing_images join. Falls back to the single cover.
 */
export function listingImagesFromPrimaryFields(
  primaryImageUrl: string | null | undefined,
  primaryThumbnailUrl: string | null | undefined,
  tileGalleryImages?: unknown,
): ListingImageForCard[] | null {
  const fromGallery = asTileGalleryImages(tileGalleryImages)
  if (fromGallery.length > 0) return fromGallery

  const url = typeof primaryImageUrl === "string" ? primaryImageUrl.trim() : ""
  if (!url) return null
  const thumb =
    typeof primaryThumbnailUrl === "string" && primaryThumbnailUrl.trim()
      ? primaryThumbnailUrl.trim()
      : null
  return [{ url, thumbnail_url: thumb, is_primary: true }]
}

/** Prefer nested images when present; otherwise use denormalized card columns. */
export function coalesceListingImagesForCard(row: {
  listing_images?: ListingImageForCard[] | null
  primary_image_url?: string | null
  primary_thumbnail_url?: string | null
  tile_gallery_images?: unknown
}): ListingImageForCard[] | null {
  if (Array.isArray(row.listing_images) && row.listing_images.length > 0) {
    return row.listing_images
  }
  return listingImagesFromPrimaryFields(
    row.primary_image_url,
    row.primary_thumbnail_url,
    row.tile_gallery_images,
  )
}

/** Attach `listing_images` for card UIs after a denorm-only select. */
export function hydrateCardListingImages<
  T extends {
    listing_images?: ListingImageForCard[] | null
    primary_image_url?: string | null
    primary_thumbnail_url?: string | null
    tile_gallery_images?: unknown
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
  images: ListingImageForCard[] | null | undefined | unknown,
): string[][] {
  const list = asListingImageArray(images)
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
  images: ListingImageForCard[] | null | undefined | unknown,
): string[] {
  const list = asListingImageArray(images)
  const primary = list.find((i) => i.is_primary) || list[0]
  if (!primary) return []

  const out: string[] = []
  const seen = new Set<string>()
  const storedThumb = primary.thumbnail_url?.trim() || ""
  const fullRaw = primary.url?.trim() || ""
  const full = listingFullImageUrlFromRef(fullRaw) ?? fullRaw

  // Compact rows stay on the persisted 640px thumb. Marketplace tiles do not.
  if (listingStoredThumbIsDistinctFromFull(storedThumb, fullRaw)) {
    pushUniqueCandidate(out, seen, proxiedListingImageSrc(storedThumb))
  }
  if (full) {
    listingFullObjectSrcCandidates(full, out, seen)
  }

  return out
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
  images: ListingImageForCard[] | null | undefined | unknown,
): string | null {
  const list = asListingImageArray(images)
  const primary = list.find((i) => i.is_primary) || list[0]
  const raw = primary?.url?.trim()
  if (!raw) return null
  const proxied = proxiedListingImageSrc(raw)
  return proxied || null
}
