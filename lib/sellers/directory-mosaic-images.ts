import {
  asListingImageArray,
  listingFilmImageSrcCandidatesFromRow,
  type ListingImageForCard,
} from "@/lib/listing-image-display"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import {
  profileBannerObjectPosition,
  resolveProfileBannerFocal,
} from "@/lib/utils/profile-banner-focal"

/** Covers shown in the directory tile grid (hero + two stack cells). */
export const SELLER_DIRECTORY_MOSAIC_DISPLAY_COUNT = 3
/**
 * Extra listing covers kept behind the display slots so a 404 can promote the
 * next cover instead of leaving an empty mosaic cell.
 */
export const SELLER_DIRECTORY_MOSAIC_COVER_POOL = 6

export type SellerDirectoryMosaicSlot = {
  /** Ordered URL fallbacks for one cover (film → card → full). */
  candidates: string[]
  alt: string
  /** Cover crop for a seller-chosen directory tile. Listing covers stay centered. */
  objectPosition?: string
}

type MosaicListingPick = {
  title: string
  listing_images: ListingImageForCard[] | null
}

type MosaicShopPick = {
  shop_name: string | null
  display_name: string | null
  shop_tile_banner_url?: string | null
  shop_tile_banner_focal_x_pct?: number | string | null
  shop_tile_banner_focal_y_pct?: number | string | null
  shop_logo_url: string | null
  avatar_url: string | null
}

function focalPct(raw: number | string | null | undefined): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function trimUrl(raw: string | null | undefined): string | null {
  const t = typeof raw === "string" ? raw.trim() : ""
  return t.length > 0 ? t : null
}

function pushUniqueCandidates(
  slots: string[][],
  seen: Set<string>,
  candidates: string[],
): void {
  const unique = candidates.map((c) => c.trim()).filter((c) => c.length > 0 && !seen.has(c))
  if (unique.length === 0) return
  for (const c of unique) seen.add(c)
  slots.push(unique)
}

/**
 * One cover per listing, at the film size (~400px) with card/full fallbacks.
 * Directory cells are a fraction of a marketplace card, so the 960px card file
 * keeps the shimmer up when film is missing.
 */
function directoryMosaicCoverCandidates(
  images: ListingImageForCard[] | ListingImageForCard | null | undefined,
): string[] {
  const list = asListingImageArray(images)
  const primary = list.find((image) => image.is_primary) || list[0]
  if (!primary) return []
  return listingFilmImageSrcCandidatesFromRow(primary)
}

/** One cover per listing. Keep a small pool so a broken object can be replaced. */
function collectListingCoverCandidateLists(
  listings: MosaicListingPick[],
  limit: number,
): string[][] {
  const seen = new Set<string>()
  const lists: string[][] = []
  for (const listing of listings) {
    pushUniqueCandidates(lists, seen, directoryMosaicCoverCandidates(listing.listing_images))
    if (lists.length >= limit) return lists
  }
  return lists
}

function shopTileBannerUrl(shop: MosaicShopPick): string | null {
  const raw = trimUrl(shop.shop_tile_banner_url)
  return raw ? profileMediaDisplaySrc(raw) : null
}

function collectShopIdentityUrls(shop: MosaicShopPick): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  for (const raw of [shop.shop_logo_url, shop.avatar_url]) {
    const t = trimUrl(raw)
    if (!t) continue
    const display = profileMediaDisplaySrc(t)
    if (!display || seen.has(display)) continue
    seen.add(display)
    urls.push(display)
  }
  return urls
}

/**
 * Directory tile imagery. A seller-chosen tile banner fills the card on its own.
 * Otherwise listing covers (pool larger than the grid) so a 404 can promote the
 * next cover. The profile header banner is not used here. Identity images
 * (logo / avatar) are last-resort only — they already appear on the overlay.
 */
export function buildSellerDirectoryMosaicSlots(
  listings: MosaicListingPick[],
  shop: MosaicShopPick,
): SellerDirectoryMosaicSlot[] {
  const tileBanner = shopTileBannerUrl(shop)
  if (tileBanner) {
    const focal = resolveProfileBannerFocal(
      focalPct(shop.shop_tile_banner_focal_x_pct),
      focalPct(shop.shop_tile_banner_focal_y_pct),
    )
    return [
      {
        candidates: [tileBanner],
        alt: "",
        objectPosition: profileBannerObjectPosition(focal),
      },
    ]
  }

  const listingLists = collectListingCoverCandidateLists(
    listings,
    SELLER_DIRECTORY_MOSAIC_COVER_POOL,
  )

  if (listingLists.length === 0) {
    const identity = collectShopIdentityUrls(shop)
    if (identity[0]) {
      return [{ candidates: [identity[0]], alt: "" }]
    }
    return []
  }

  return listingLists.map((candidates) => ({
    candidates,
    alt: "",
  }))
}

export function sellerDirectoryMosaicHasRenderableImage(
  slots: SellerDirectoryMosaicSlot[],
): boolean {
  return slots.some((slot) => slot.candidates.some((src) => src.length > 0))
}
