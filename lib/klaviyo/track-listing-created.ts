/**
 * Server-only: Klaviyo Events API (private key). No-op if KLAVIYO_API_KEY is unset.
 *
 * **Metric name in Klaviyo:** `Listing` — use as the flow trigger when a seller publishes
 * on `/sell` (new insert, draft → live, or `POST /api/listings`). Event `properties.Created`
 * is `true`; optional flow filter: `Created` equals true.
 *
 * **Building the flow in Klaviyo:** Flows → Create flow → Metric → select **Listing** →
 * add email/content; profile on the event is the seller (`external_id` = Supabase user id).
 *
 * **Sell abandonment:** use as the “published” branch on flows triggered by **Viewed Sell Page**
 * (conditional split: has done **Listing** since starting this flow). See `track-viewed-sell-page.ts`.
 *
 * @see https://developers.klaviyo.com/en/reference/create_event
 */

import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type KlaviyoListingCreatedPayload = {
  sellerUserId: string
  sellerEmail?: string | null
  listingId: string
  title: string
  price: number
  photoUrl: string | null
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
    photoUrl,
  } = payload

  const priceNum = typeof price === "number" ? price : Number(price)

  await sendKlaviyoServerEvent({
    metricName: "Listing",
    properties: {
      Created: true,
      Title: title,
      Price: Number.isFinite(priceNum) ? priceNum : price,
      photo_url: photoUrl ?? "",
      listing_id: listingId,
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
