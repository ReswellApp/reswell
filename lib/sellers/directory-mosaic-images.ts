import {
  asListingImageArray,
  listingFilmImageSrcFromRow,
  type ListingImageForCard,
} from "@/lib/listing-image-display"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import {
  profileBannerObjectPosition,
  resolveProfileBannerFocal,
} from "@/lib/utils/profile-banner-focal"

const MOSAIC_SLOT_COUNT = 3

export type SellerDirectoryMosaicSlot = {
  src: string
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

function pushUnique(urls: string[], seen: Set<string>, url: string | null | undefined): void {
  const t = trimUrl(url)
  if (!t || seen.has(t)) return
  seen.add(t)
  urls.push(t)
}

/**
 * One cover per listing, at the film size (~400px). Directory cells are a
 * fraction of a marketplace card, so the 960px card file keeps the shimmer up.
 */
function directoryMosaicCoverSrc(
  images: ListingImageForCard[] | ListingImageForCard | null | undefined,
): string {
  const list = asListingImageArray(images)
  const primary = list.find((image) => image.is_primary) || list[0]
  if (!primary) return ""
  return listingFilmImageSrcFromRow(primary)
}

/** One cover per listing. The mosaic shows at most three frames. */
function collectListingCoverUrls(listings: MosaicListingPick[], limit: number): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  for (const listing of listings) {
    pushUnique(urls, seen, directoryMosaicCoverSrc(listing.listing_images))
    if (urls.length >= limit) return urls
  }
  return urls
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
    if (t) pushUnique(urls, seen, profileMediaDisplaySrc(t))
  }
  return urls
}

/**
 * Directory tile imagery. A seller-chosen tile banner fills the card on its own.
 * Otherwise up to three listing covers. The profile header banner is not used here.
 * Identity images (logo / avatar) are last-resort only — they already appear on the overlay.
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
        src: tileBanner,
        alt: "",
        objectPosition: profileBannerObjectPosition(focal),
      },
    ]
  }

  const listingUrls = collectListingCoverUrls(listings, MOSAIC_SLOT_COUNT)

  const seen = new Set<string>()
  const urls: string[] = []
  for (const url of listingUrls) {
    pushUnique(urls, seen, url)
    if (urls.length >= MOSAIC_SLOT_COUNT) break
  }

  if (urls.length === 0) {
    const identity = collectShopIdentityUrls(shop)
    if (identity[0]) urls.push(identity[0])
  }

  return urls.map((src) => ({
    src,
    alt: "",
  }))
}

export function sellerDirectoryMosaicHasRenderableImage(
  slots: SellerDirectoryMosaicSlot[],
): boolean {
  return slots.some((slot) => slot.src.length > 0)
}
