import {
  listingTileCarouselImageUrls,
  type ListingImageForCard,
} from "@/lib/listing-image-display"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"

const MOSAIC_SLOT_COUNT = 3

export type SellerDirectoryMosaicSlot = {
  src: string
  alt: string
  /** Tried in order when `src` fails to load (e.g. deleted storage object behind a stale cache). */
  fallbackSrcs?: string[]
}

type MosaicListingPick = {
  title: string
  listing_images: ListingImageForCard[] | null
}

type MosaicShopPick = {
  shop_name: string | null
  display_name: string | null
  shop_banner_url: string | null
  shop_logo_url: string | null
  avatar_url: string | null
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

/** First photo from each listing, then extra listing photos — never repeats a URL. */
function collectListingPhotoUrls(listings: MosaicListingPick[], limit: number): string[] {
  const perListing = listings.map((listing) =>
    listingTileCarouselImageUrls(listing.listing_images),
  )
  const seen = new Set<string>()
  const urls: string[] = []

  for (const listingUrls of perListing) {
    pushUnique(urls, seen, listingUrls[0])
    if (urls.length >= limit) return urls
  }

  let round = 1
  while (urls.length < limit) {
    let added = false
    for (const listingUrls of perListing) {
      const url = listingUrls[round]
      if (url && !seen.has(url)) {
        pushUnique(urls, seen, url)
        added = true
        if (urls.length >= limit) return urls
      }
    }
    if (!added) break
    round += 1
  }

  return urls
}

function shopBannerUrl(shop: MosaicShopPick): string | null {
  const raw = trimUrl(shop.shop_banner_url)
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

/** Every renderable candidate URL for a seller tile, in preference order, deduped. */
function collectAllCandidateUrls(listings: MosaicListingPick[], shop: MosaicShopPick): string[] {
  const seen = new Set<string>()
  const urls: string[] = []

  const banner = shopBannerUrl(shop)
  if (banner) pushUnique(urls, seen, banner)

  for (const listing of listings) {
    for (const url of listingTileCarouselImageUrls(listing.listing_images)) {
      pushUnique(urls, seen, url)
    }
  }

  for (const url of collectShopIdentityUrls(shop)) {
    pushUnique(urls, seen, url)
  }

  return urls
}

/**
 * Up to three unique storefront images. Shops lead with their banner when they have one,
 * then listing photos. Identity images (logo / avatar) are last-resort only — they already
 * appear on the tile overlay.
 */
export function buildSellerDirectoryMosaicSlots(
  listings: MosaicListingPick[],
  shop: MosaicShopPick,
): SellerDirectoryMosaicSlot[] {
  const banner = shopBannerUrl(shop)
  const listingLimit = banner ? MOSAIC_SLOT_COUNT - 1 : MOSAIC_SLOT_COUNT
  const listingUrls = collectListingPhotoUrls(listings, listingLimit)

  const seen = new Set<string>()
  const urls: string[] = []
  if (banner) pushUnique(urls, seen, banner)
  for (const url of listingUrls) {
    pushUnique(urls, seen, url)
    if (urls.length >= MOSAIC_SLOT_COUNT) break
  }

  if (urls.length === 0) {
    const identity = collectShopIdentityUrls(shop)
    if (identity[0]) urls.push(identity[0])
  }

  if (urls.length === 0) return []

  const allCandidates = collectAllCandidateUrls(listings, shop)

  return urls.map((src) => ({
    src,
    alt: "",
    fallbackSrcs: allCandidates.filter((url) => url !== src),
  }))
}

export function sellerDirectoryMosaicHasRenderableImage(
  slots: SellerDirectoryMosaicSlot[],
): boolean {
  return slots.some((slot) => slot.src.length > 0)
}
