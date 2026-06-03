/**
 * Server-only: Klaviyo Events API — fires when a shopper hits a no-results dead end and
 * asks Reswell to source the board / notify them when one is listed.
 *
 * **Metric name in Klaviyo:** `Board Listing Request` — create a flow triggered on this metric
 * to confirm we're on the hunt and to re-engage once matching supply lands.
 * The event profile is the requester (email; `external_id` = Supabase user id when signed in).
 */

import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type KlaviyoBoardListingRequestPayload = {
  email: string
  /** Supabase user id when the requester is signed in. */
  requesterUserId?: string | null
  /** Raw keyword searched, when present. */
  query?: string | null
  /** Human-readable snapshot of what they were looking for. */
  summary: string
  /** Which no-results surface captured the request. */
  source: "boards" | "search"
  brand?: string | null
  model?: string | null
  dimensions?: string | null
  condition?: string | null
  boardType?: string | null
}

export async function trackKlaviyoBoardListingRequest(
  payload: KlaviyoBoardListingRequestPayload,
): Promise<void> {
  await sendKlaviyoServerEvent({
    metricName: "Board Listing Request",
    properties: {
      Query: payload.query ?? "",
      Summary: payload.summary,
      Source: payload.source,
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
  })
}
