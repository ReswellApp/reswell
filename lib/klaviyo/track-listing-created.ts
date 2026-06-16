/**
 * Server-only: Klaviyo Events API (private key). No-op if KLAVIYO_API_KEY is unset.
 *
 * **Metric name in Klaviyo:** `Listing` — use as the flow trigger when a seller publishes
 * on `/sell` (new insert, draft → live, or `POST /api/listings`). Event `properties.Created`
 * is `true`; optional flow filter: `Created` equals true.
 *
 * **Building the flow in Klaviyo:** Flows → Create flow → Metric → select **Listing** →
 * add email/content; profile on the event is the seller (`external_id` = Supabase user id).
 * Split on `fulfillment_mode`: `pickup_only`, `shipping_only`, or `pickup_and_shipping`
 * (or booleans `local_pickup` / `shipping_available`).
 *
 * **Sell abandonment:** use as the “published” branch on flows triggered by **Viewed Sell Page**
 * (conditional split: has done **Listing** since starting this flow). See `track-viewed-sell-page.ts`.
 *
 * @see https://developers.klaviyo.com/en/reference/create_event
 */

import { absoluteKlaviyoListingPhotoUrl } from "@/lib/klaviyo/catalog-product"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import {
  boardFulfillmentFromFlags,
  boardFulfillmentSummary,
  type BoardFulfillmentChoice,
} from "@/lib/listing-fulfillment"

export type KlaviyoListingCreatedPayload = {
  sellerUserId: string
  sellerEmail?: string | null
  listingId: string
  title: string
  price: number
  photoUrl: string | null
  localPickup?: boolean | null
  shippingAvailable?: boolean | null
}

function listingFulfillmentEventFields(
  localPickup: boolean | null | undefined,
  shippingAvailable: boolean | null | undefined,
): {
  local_pickup: boolean
  shipping_available: boolean
  fulfillment_mode: BoardFulfillmentChoice
  fulfillment_label: string
} {
  const local_pickup = localPickup !== false
  const shipping_available = !!shippingAvailable
  const fulfillment_mode = boardFulfillmentFromFlags(local_pickup, shipping_available)
  return {
    local_pickup,
    shipping_available,
    fulfillment_mode,
    fulfillment_label: boardFulfillmentSummary(local_pickup, shipping_available),
  }
}

export async function trackKlaviyoListingCreated(
  payload: KlaviyoListingCreatedPayload,
): Promise<void> {
  const {
    sellerUserId,
    sellerEmail,
    listingId,
    title,
    price,
  } = payload

  const priceNum = typeof price === "number" ? price : Number(price)
  const fulfillment = listingFulfillmentEventFields(
    payload.localPickup,
    payload.shippingAvailable,
  )

  await sendKlaviyoServerEvent({
    metricName: "Listing",
    properties: {
      Created: true,
      Title: title,
      Price: Number.isFinite(priceNum) ? priceNum : price,
      photo_url: payload.photoUrl ? absoluteKlaviyoListingPhotoUrl(payload.photoUrl) : "",
      listing_id: listingId,
      local_pickup: fulfillment.local_pickup,
      shipping_available: fulfillment.shipping_available,
      fulfillment_mode: fulfillment.fulfillment_mode,
      fulfillment_label: fulfillment.fulfillment_label,
    },
    profile: {
      external_id: sellerUserId,
      email: sellerEmail,
    },
    uniqueId: `listing-${listingId}-created`,
    value: Number.isFinite(priceNum) ? priceNum : undefined,
    valueCurrency: "USD",
  })
}
