/**
 * Server-only: Klaviyo Events API — fires when a new surfboard listing matches a buyer's saved search.
 *
 * **Metric name in Klaviyo:** `Board Alert Match` — create a flow triggered on this metric;
 * profile on the event is the subscriber (`external_id` = Supabase user id).
 *
 * Flow filters can branch on properties such as Listing_ID, Saved_Search_ID, Brand, Model.
 */

import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"

export type KlaviyoBoardAlertMatchPayload = {
  subscriberUserId: string
  subscriberEmail?: string | null
  savedSearchId: string
  listingId: string
  listingTitle: string
  listingPrice: number
  /** Absolute listing URL for email buttons */
  listingAbsoluteUrl: string
  listingPhotoUrl: string | null
  /** Snapshot for template personalization */
  brand?: string | null
  model?: string | null
  dimensions?: string | null
  condition?: string | null
  boardType?: string | null
}

export async function trackKlaviyoBoardAlertMatch(
  payload: KlaviyoBoardAlertMatchPayload,
): Promise<void> {
  let email = payload.subscriberEmail?.trim() || null
  if (!email) {
    email = await getAuthEmailForUserId(payload.subscriberUserId)
  }

  const priceNum =
    typeof payload.listingPrice === "number" ? payload.listingPrice : Number(payload.listingPrice)

  await sendKlaviyoServerEvent({
    metricName: "Board Alert Match",
    properties: {
      Listing_ID: payload.listingId,
      Saved_Search_ID: payload.savedSearchId,
      Title: payload.listingTitle,
      Price: Number.isFinite(priceNum) ? priceNum : payload.listingPrice,
      Listing_URL: payload.listingAbsoluteUrl,
      photo_url: payload.listingPhotoUrl ?? "",
      Brand: payload.brand ?? "",
      Model: payload.model ?? "",
      Dimensions: payload.dimensions ?? "",
      Condition: payload.condition ?? "",
      Board_Type: payload.boardType ?? "",
    },
    profile: {
      external_id: payload.subscriberUserId,
      email,
    },
    uniqueId: `board-alert-${payload.savedSearchId}-${payload.listingId}`,
    value: Number.isFinite(priceNum) ? priceNum : undefined,
    valueCurrency: "USD",
  })
}
