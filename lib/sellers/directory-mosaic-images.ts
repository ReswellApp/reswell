import {
  listingTileCarouselImageUrls,
  type ListingImageForCard,
} from "@/lib/listing-image-display"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"

const MOSAIC_SLOT_COUNT = 3

export type SellerDirectoryMosaicSlot = {
  src: string
  alt: string
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

function sellerLabel(shop: MosaicShopPick): string {
  return shop.shop_name?.trim() || shop.display_name?.trim() || "Seller"
}

function trimUrl(raw: string | null | undefined): string | null {
  const t = typeof raw === "string" ? raw.trim() : ""
  return t.length > 0 ? t : null
}

/** Collect listing photo URLs: first image from each listing, then additional photos round-robin. */
function collectListingPhotoUrls(listings: MosaicListingPick[]): string[] {
  const perListing = listings.map((listing) =>
    listingTileCarouselImageUrls(listing.listing_images),
  )

  const urls: string[] = []

  for (const listingUrls of perListing) {
    if (listingUrls[0]) urls.push(listingUrls[0])
  }

  let round = 1
  while (urls.length < MOSAIC_SLOT_COUNT) {
    let added = false
    for (const listingUrls of perListing) {
      const url = listingUrls[round]
      if (url) {
        urls.push(url)
        added = true
        if (urls.length >= MOSAIC_SLOT_COUNT) break
      }
    }
    if (!added) break
    round += 1
  }

  if (urls.length === 0) return []

  while (urls.length < MOSAIC_SLOT_COUNT) {
    urls.push(urls[urls.length % urls.length]!)
  }

  return urls.slice(0, MOSAIC_SLOT_COUNT)
}

function collectShopFallbackUrls(shop: MosaicShopPick): string[] {
  const raw = [
    trimUrl(shop.shop_banner_url),
    trimUrl(shop.shop_logo_url),
    trimUrl(shop.avatar_url),
  ]
    .map((url) => (url ? profileMediaDisplaySrc(url) : ""))
    .filter((url): url is string => url.length > 0)

  if (raw.length === 0) return []

  const urls: string[] = []
  while (urls.length < MOSAIC_SLOT_COUNT) {
    urls.push(raw[urls.length % raw.length]!)
  }
  return urls.slice(0, MOSAIC_SLOT_COUNT)
}

/**
 * Always returns three mosaic slots. Reuses listing photos (including repeats) before
 * falling back to shop banner / logo / avatar — never placeholder tiles.
 */
export function buildSellerDirectoryMosaicSlots(
  listings: MosaicListingPick[],
  shop: MosaicShopPick,
): SellerDirectoryMosaicSlot[] {
  const label = sellerLabel(shop)
  const listingUrls = collectListingPhotoUrls(listings)
  const urls = listingUrls.length > 0 ? listingUrls : collectShopFallbackUrls(shop)

  if (urls.length === 0) {
    return Array.from({ length: MOSAIC_SLOT_COUNT }, (_, index) => ({
      src: "",
      alt: listings[index]?.title ?? label,
    }))
  }

  return urls.map((src, index) => ({
    src,
    alt: listings[index]?.title ?? listings[0]?.title ?? label,
  }))
}

export function sellerDirectoryMosaicHasRenderableImage(slots: SellerDirectoryMosaicSlot[]): boolean {
  return slots.some((slot) => slot.src.length > 0)
}
