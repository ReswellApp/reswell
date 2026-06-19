/**
 * Klaviyo Events API — buyer saved a listing to favorites.
 *
 * **Metric:** `Listing Saved` — profile is the **buyer** (`external_id` = Supabase user id).
 * Includes **ProductID** + **Items** for Klaviyo dynamic product blocks (catalog `$id` = listing id).
 *
 * **Flow:** Flows → Metric → **Listing Saved** → dynamic product block → products from event.
 * Seller notification stays on separate metric **Favorites button**.
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import {
  buildKlaviyoFavoritesCommercePayload,
  LISTING_SAVED_METRIC,
} from "@/lib/klaviyo/favorites-commerce-event"
import type { KlaviyoListingProductSource } from "@/lib/klaviyo/catalog-product"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type TrackKlaviyoListingSavedPayload = {
  buyerUserId: string
  buyerEmail?: string | null
  favoriteId: string
  favoritedAt: string
  listing: KlaviyoListingProductSource
}

export async function trackKlaviyoListingSaved(
  payload: TrackKlaviyoListingSavedPayload,
): Promise<Awaited<ReturnType<typeof sendKlaviyoServerEvent>>> {
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

  const title =
    typeof payload.listing.title === "string" ? payload.listing.title.trim() : "Saved listing"

  return sendKlaviyoServerEvent({
    metricName: LISTING_SAVED_METRIC,
    profile: {
      external_id: payload.buyerUserId,
      email,
    },
    uniqueId: `listing-saved-${payload.favoriteId}`,
    properties: {
      time: payload.favoritedAt,
      ...commerce,
      listing_id: payload.listing.id,
      Title: title,
      favorite_id: payload.favoriteId,
    },
    value: commerce.checkout_items[0]?.price ?? undefined,
    valueCurrency: "USD",
  })
}
