/**
 * Server-only: Klaviyo Events API — fires when a new surfboard listing matches a buyer's
 * no-results "notify me when listed" request (board_listing_requests).
 *
 * **Metric name in Klaviyo:** `Board Listing Match` — create a flow triggered on this metric;
 * profile on the event is the requester (email; `external_id` = Supabase user id when signed in).
 *
 * Distinct from `Board Alert Match` (logged-in saved /boards filters) and
 * `Board Listing Request` (confirmation when the shopper submits the dead-end form).
 */

import { absoluteKlaviyoListingPhotoUrl } from "@/lib/klaviyo/catalog-product"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type KlaviyoBoardListingMatchPayload = {
  email: string
  requesterUserId?: string | null
  requestId: string
  /** Raw keyword searched, when present. */
  query?: string | null
  /** Human-readable snapshot of what they were looking for. */
  summary: string
  listingId: string
  listingTitle: string
  listingPrice: number
  listingAbsoluteUrl: string
  listingPhotoUrl: string | null
  brand?: string | null
  model?: string | null
  dimensions?: string | null
  condition?: string | null
  boardType?: string | null
}

export async function trackKlaviyoBoardListingMatch(
  payload: KlaviyoBoardListingMatchPayload,
): Promise<void> {
  const priceNum =
    typeof payload.listingPrice === "number" ? payload.listingPrice : Number(payload.listingPrice)

  await sendKlaviyoServerEvent({
    metricName: "Board Listing Match",
    properties: {
      Request_ID: payload.requestId,
      Query: payload.query ?? "",
      Summary: payload.summary,
      Listing_ID: payload.listingId,
      Title: payload.listingTitle,
      Price: Number.isFinite(priceNum) ? priceNum : payload.listingPrice,
      Listing_URL: payload.listingAbsoluteUrl,
      photo_url: payload.listingPhotoUrl
        ? absoluteKlaviyoListingPhotoUrl(payload.listingPhotoUrl)
        : "",
      Brand: payload.brand ?? "",
      Model: payload.model ?? "",
      Dimensions: payload.dimensions ?? "",
      Condition: payload.condition ?? "",
      Board_Type: payload.boardType ?? "",
    },
    profile: {
      external_id: payload.requesterUserId?.trim() || undefined,
      email: payload.email,
    },
    uniqueId: `board-listing-match-${payload.requestId}-${payload.listingId}`,
    value: Number.isFinite(priceNum) ? priceNum : undefined,
    valueCurrency: "USD",
  })
}
