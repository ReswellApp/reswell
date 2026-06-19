/**
 * Klaviyo Events API — a listing the buyer saved dropped in price.
 *
 * **Metric:** `Favorite Price Drop` — profile is the buyer. **Items** = the discounted listing.
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import {
  buildKlaviyoFavoritesCommercePayload,
  FAVORITE_PRICE_DROP_METRIC,
  formatFavoritePriceDropDisplay,
} from "@/lib/klaviyo/favorites-commerce-event"
import type { KlaviyoListingProductSource } from "@/lib/klaviyo/catalog-product"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type TrackKlaviyoFavoritePriceDropPayload = {
  buyerUserId: string
  buyerEmail?: string | null
  listing: KlaviyoListingProductSource
  oldPriceUsd: number
  newPriceUsd: number
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

  return sendKlaviyoServerEvent({
    metricName: FAVORITE_PRICE_DROP_METRIC,
    profile: {
      external_id: payload.buyerUserId,
      email,
    },
    uniqueId: `favorite-price-drop-${payload.buyerUserId}-${payload.listing.id}-${payload.newPriceUsd}`,
    properties: {
      time: new Date().toISOString(),
      ...commerce,
      listing_id: payload.listing.id,
      Title: title,
      old_price_usd: payload.oldPriceUsd,
      new_price_usd: payload.newPriceUsd,
      price_drop_display: formatFavoritePriceDropDisplay(
        payload.oldPriceUsd,
        payload.newPriceUsd,
      ),
      price_drop_percent: dropPct,
    },
    value: payload.newPriceUsd,
    valueCurrency: "USD",
  })
}
