/**
 * Shared commerce payload for buyer favorites Klaviyo metrics (Items + checkout_items).
 * ProductID values match the custom catalog feed (`/api/integrations/klaviyo/catalog-feed`).
 */

import {
  formatKlaviyoPriceDisplay,
  klaviyoCommerceEventProperties,
  listingToKlaviyoCheckoutEventItem,
  listingToKlaviyoEventCommerceItem,
  type KlaviyoCheckoutEventItem,
  type KlaviyoEventCommerceItem,
  type KlaviyoListingProductSource,
  parseKlaviyoListingPrice,
} from "@/lib/klaviyo/catalog-product"
import { favoritesKlaviyoEmailProperties } from "@/lib/klaviyo/favorites-email-html"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"

export const LISTING_SAVED_METRIC = "Listing Saved"
export const FAVORITES_DIGEST_METRIC = "Favorites Digest"
export const FAVORITE_PRICE_DROP_METRIC = "Favorite Price Drop"

export const FAVORITES_DIGEST_MAX_ITEMS = 12

export type KlaviyoFavoritesCommercePayload = {
  ProductID: string
  Items: KlaviyoEventCommerceItem[]
  checkout_items: KlaviyoCheckoutEventItem[]
  item_count: number
  listing_ids: string
  favorites_url: string
  favorites_items_html: string
  favorites_items_plain: string
}

export function buildKlaviyoFavoritesCommercePayload(
  listings: KlaviyoListingProductSource[],
): KlaviyoFavoritesCommercePayload | null {
  if (listings.length === 0) return null

  const commerceItems = listings.map((listing) => listingToKlaviyoEventCommerceItem(listing))
  const checkoutItems = listings.map((listing) => listingToKlaviyoCheckoutEventItem(listing))
  const primary = listings[0]
  const commerce = klaviyoCommerceEventProperties({
    primaryProductId: primary.id,
    items: commerceItems,
  })

  const favoritesUrl = `${publicSiteOriginForEmail()}/favorites`
  const emailProps = favoritesKlaviyoEmailProperties(checkoutItems, favoritesUrl)

  return {
    ...commerce,
    checkout_items: checkoutItems,
    item_count: listings.length,
    listing_ids: listings.map((listing) => listing.id).join(","),
    favorites_url: favoritesUrl,
    ...emailProps,
  }
}

export function favoritesDigestTitle(listings: KlaviyoListingProductSource[]): string {
  if (listings.length === 1) {
    const title = typeof listings[0].title === "string" ? listings[0].title.trim() : ""
    return title || "Your saved board"
  }
  return `${listings.length} saved boards`
}

export function favoritesDigestValue(listings: KlaviyoListingProductSource[]): number | undefined {
  let sum = 0
  for (const listing of listings) {
    const price = parseKlaviyoListingPrice(listing.price)
    if (price != null) sum += price
  }
  return sum > 0 ? Math.round(sum * 100) / 100 : undefined
}

export function formatFavoritePriceDropDisplay(oldPrice: number, newPrice: number): string {
  return `${formatKlaviyoPriceDisplay(oldPrice)} → ${formatKlaviyoPriceDisplay(newPrice)}`
}
