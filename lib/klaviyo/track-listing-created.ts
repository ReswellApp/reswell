/**
 * Server-only: Klaviyo Events API (private key). No-op if KLAVIYO_API_KEY is unset.
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
