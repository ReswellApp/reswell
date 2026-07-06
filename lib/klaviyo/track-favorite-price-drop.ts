/**
 * Klaviyo Events API — a listing dropped in price for a buyer who saved it (favorites and/or cart).
 *
 * **Metric:** `Favorite Price Drop` — profile is the buyer.
 *
 * **Build the flow in Klaviyo**
 * 1. Flows → Create flow → Metric → **Favorite Price Drop** (API).
 * 2. Email → add an **HTML** block (not Text). Paste `KLAVIYO_FAVORITE_PRICE_DROP_EMAIL_HTML`
 *    from `lib/klaviyo/favorites-email-liquid.ts` — **no `{% %}` tags** (Klaviyo often prints those as raw text).
 *    Use Preview & test → pick a profile with a real **Favorite Price Drop** event.
 *    - `{{ event.primary_cta_url }}` / `{{ event.primary_cta_label }}` — checkout vs saves CTA (set server-side)
 * 3. Optional subject/body personalization:
 *
 * Fires when a seller lowers list price on a published listing (quick price edit today).
 * One event per buyer per listing per new price (deduped via `unique_id`).
 */

import { listingDetailHref, peerListingCheckoutHref } from "@/lib/listing-href"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import {
  buildKlaviyoFavoritesCommercePayload,
  FAVORITE_PRICE_DROP_METRIC,
  formatFavoritePriceDropDisplay,
} from "@/lib/klaviyo/favorites-commerce-event"
import {
  absoluteKlaviyoListingImageUrl,
  formatKlaviyoPriceDisplay,
} from "@/lib/klaviyo/catalog-product"
import { favoritesKlaviyoEmailProperties } from "@/lib/klaviyo/favorites-email-html"
import type { KlaviyoListingProductSource } from "@/lib/klaviyo/catalog-product"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type KlaviyoListingPriceDropInterestSource = "favorite" | "cart"

export type TrackKlaviyoFavoritePriceDropPayload = {
  buyerUserId: string
  buyerEmail?: string | null
  listing: KlaviyoListingProductSource
  oldPriceUsd: number
  newPriceUsd: number
  interestSources: KlaviyoListingPriceDropInterestSource[]
}

function resolveListingPriceDropUrls(listing: KlaviyoListingProductSource): {
  cartUrl: string
  checkoutUrl: string
} {
  const origin = publicSiteOriginForEmail()
  const section = typeof listing.section === "string" ? listing.section : "surfboards"
  const checkoutParam =
    (typeof listing.slug === "string" && listing.slug.trim()) || listing.id
  return {
    cartUrl: `${origin}/cart`,
    checkoutUrl: `${origin}${peerListingCheckoutHref(section, checkoutParam)}`,
  }
}

export async function trackKlaviyoFavoritePriceDrop(
  payload: TrackKlaviyoFavoritePriceDropPayload,
): Promise<Awaited<ReturnType<typeof sendKlaviyoServerEvent>>> {
  if (!(payload.newPriceUsd < payload.oldPriceUsd)) {
    return {
      ok: false,
      status: 0,
      skipped: true,
      skipReason: "Not a price drop",
      detail: "",
    }
  }

  if (payload.interestSources.length === 0) {
    return {
      ok: false,
      status: 0,
      skipped: true,
      skipReason: "No interest sources",
      detail: "",
    }
  }

  let email = payload.buyerEmail?.trim() || null
  if (!email) {
    email = await getAuthEmailForUserId(payload.buyerUserId)
  }

  const commerce = buildKlaviyoFavoritesCommercePayload([payload.listing])
  if (!commerce) {
    return {
      ok: false,
      status: 0,
      skipped: true,
      skipReason: "Listing not eligible for commerce payload",
      detail: "",
    }
  }

  const dropPct =
    payload.oldPriceUsd > 0
      ? Math.round(((payload.oldPriceUsd - payload.newPriceUsd) / payload.oldPriceUsd) * 1000) /
        10
      : 0

  const title =
    typeof payload.listing.title === "string" ? payload.listing.title.trim() : "Saved listing"

  const inFavorites = payload.interestSources.includes("favorite")
  const inCart = payload.interestSources.includes("cart")
  const { cartUrl, checkoutUrl } = resolveListingPriceDropUrls(payload.listing)

  const priceDropDisplay = formatFavoritePriceDropDisplay(
    payload.oldPriceUsd,
    payload.newPriceUsd,
  )
  const emailWithDrop = favoritesKlaviyoEmailProperties(
    commerce.checkout_items,
    inCart ? cartUrl : commerce.favorites_url,
    {
      priceDropDisplay,
      viewAllLabel: inCart ? "View your cart" : "View all your saves",
      primaryActionUrl: inCart ? checkoutUrl : undefined,
      primaryActionLabel: inCart ? "Complete checkout" : undefined,
    },
  )

  const listingPath = listingDetailHref({
    id: payload.listing.id,
    slug: payload.listing.slug ?? undefined,
    section: typeof payload.listing.section === "string" ? payload.listing.section : "surfboards",
  })
  const listingUrl = `${publicSiteOriginForEmail()}${listingPath}`
  const listingImageUrl = absoluteKlaviyoListingImageUrl(payload.listing)
  const listingPriceDisplay = formatKlaviyoPriceDisplay(payload.newPriceUsd)
  const primaryCheckoutItem = commerce.checkout_items[0]
  const imageUrl =
    listingImageUrl.trim() ||
    (typeof primaryCheckoutItem?.image_url === "string"
      ? primaryCheckoutItem.image_url.trim()
      : "") ||
    (typeof commerce.Items[0]?.ImageURL === "string" ? commerce.Items[0].ImageURL.trim() : "")
  const primaryCtaUrl = inCart ? checkoutUrl : inFavorites ? commerce.favorites_url : listingUrl
  const primaryCtaLabel = inCart
    ? "Complete checkout"
    : inFavorites
      ? "View all your saves"
      : "View listing"
  const buttonCtaUrl = inCart && checkoutUrl.trim() ? checkoutUrl : listingUrl
  const buttonCtaLabel = inCart ? "Complete checkout" : "View listing"

  return sendKlaviyoServerEvent({
    metricName: FAVORITE_PRICE_DROP_METRIC,
    profile: {
      external_id: payload.buyerUserId,
      email,
    },
    uniqueId: `listing-price-drop-${payload.buyerUserId}-${payload.listing.id}-${payload.newPriceUsd}`,
    properties: {
      time: new Date().toISOString(),
      ...commerce,
      ...emailWithDrop,
      listing_id: payload.listing.id,
      listing_url: listingUrl,
      listing_image_url: imageUrl,
      photo_url: imageUrl,
      listing_price_display: listingPriceDisplay,
      price_display: listingPriceDisplay,
      primary_cta_url: primaryCtaUrl,
      primary_cta_label: primaryCtaLabel,
      button_cta_url: buttonCtaUrl,
      button_cta_label: buttonCtaLabel,
      Title: title,
      Price: payload.newPriceUsd,
      old_price_usd: payload.oldPriceUsd,
      new_price_usd: payload.newPriceUsd,
      price_drop_display: priceDropDisplay,
      price_drop_percent: dropPct,
      interest_sources: payload.interestSources.join(","),
      in_favorites: inFavorites,
      in_cart: inCart,
      cart_url: inCart ? cartUrl : "",
      checkout_url: inCart ? checkoutUrl : "",
    },
    value: payload.newPriceUsd,
    valueCurrency: "USD",
  })
}
