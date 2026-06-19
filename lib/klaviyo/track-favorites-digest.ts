/**
 * Klaviyo Events API — weekly digest of a buyer's purchasable saved listings.
 *
 * **Metric:** `Favorites Digest` — profile is the buyer. **Items** powers dynamic product blocks.
 * Cron: `GET /api/cron/klaviyo-favorites-digest` (Bearer `CRON_SECRET` when set).
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import {
  buildKlaviyoFavoritesCommercePayload,
  favoritesDigestTitle,
  favoritesDigestValue,
  FAVORITES_DIGEST_MAX_ITEMS,
  FAVORITES_DIGEST_METRIC,
} from "@/lib/klaviyo/favorites-commerce-event"
import type { KlaviyoListingProductSource } from "@/lib/klaviyo/catalog-product"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type TrackKlaviyoFavoritesDigestPayload = {
  buyerUserId: string
  buyerEmail?: string | null
  displayName?: string | null
  listings: KlaviyoListingProductSource[]
  /** ISO week bucket for dedupe, e.g. `2026-W25` */
  digestWeekKey: string
}

export async function trackKlaviyoFavoritesDigest(
  payload: TrackKlaviyoFavoritesDigestPayload,
): Promise<Awaited<ReturnType<typeof sendKlaviyoServerEvent>>> {
  const capped = payload.listings.slice(0, FAVORITES_DIGEST_MAX_ITEMS)
  const commerce = buildKlaviyoFavoritesCommercePayload(capped)
  if (!commerce) {
    return {
      ok: false,
      status: 0,
      skipped: true,
      skipReason: "No purchasable favorites",
      detail: "",
    }
  }

  let email = payload.buyerEmail?.trim() || null
  if (!email) {
    email = await getAuthEmailForUserId(payload.buyerUserId)
  }

  const eventTime = new Date().toISOString()

  return sendKlaviyoServerEvent({
    metricName: FAVORITES_DIGEST_METRIC,
    profile: {
      external_id: payload.buyerUserId,
      email,
    },
    uniqueId: `favorites-digest-${payload.buyerUserId}-${payload.digestWeekKey}`,
    properties: {
      time: eventTime,
      ...commerce,
      Title: favoritesDigestTitle(capped),
      display_name: payload.displayName?.trim() ?? "",
      digest_week: payload.digestWeekKey,
    },
    value: favoritesDigestValue(capped),
    valueCurrency: "USD",
  })
}
