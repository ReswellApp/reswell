/**
 * Server-only: Klaviyo Events API — fires when a new peer listing would appear in a
 * buyer's saved marketplace search (boards / fins / wetsuits / magazines / …).
 *
 * **Metric name in Klaviyo:** `Board Alert Match` — create a flow triggered on this metric;
 * profile on the event is the subscriber (`external_id` = Supabase user id).
 *
 * Flow filters can branch on properties such as Listing_ID, Saved_Search_ID, Section, Brand, Model,
 * Alert_Kind (`search` | `model` | `brand`). Keep one metric — do not create separate model/brand
 * metrics. Clone the flow and filter on Alert_Kind if you want different copy.
 * `Search_URL` is the saved search itself (e.g. `https://www.reswell.app/search?q=roberts+5%2710`).
 *
 * Board Finder saves (`Alert_Source` = `board-finder`) also send every field the shopper
 * filled in: `Wanted_Brand`, `Wanted_Model`, `Wanted_Size`, `Wanted_Style`, `Wanted_Condition`,
 * `Wanted_Min_Price`, `Wanted_Max_Price`, `Wanted_Volume`, `Wanted_Construction`,
 * `Wanted_Fin_System`, plus `Brand_URL`, `Model_URL`, and `Board_Finder_URL`.
 * Listing fields (`Brand`, `Model`, `Title`) describe the board that just listed.
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { boardAlertMatchFinderProperties } from "@/lib/klaviyo/board-alert-match-details"
import { absoluteKlaviyoListingPhotoUrl } from "@/lib/klaviyo/catalog-product"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

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
  /** Peer listing section (`surfboards`, `fins`, `wetsuits`, …). */
  section?: string | null
  /**
   * Why the subscriber saved the alert. Same metric as filter searches —
   * Klaviyo flows branch on this (`search` | `model` | `brand`).
   */
  alertKind?: string | null
  savedSearchLabel?: string | null
  /** Absolute URL of the saved search (`/search?q=…` or a section browse link). */
  searchUrl?: string | null
  searchQuery?: string | null
  /** Saved snapshot. Board Finder fields are expanded onto the event. */
  criteria?: BoardSavedSearchCriteria | null
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
      photo_url: payload.listingPhotoUrl
        ? absoluteKlaviyoListingPhotoUrl(payload.listingPhotoUrl)
        : "",
      Brand: payload.brand ?? "",
      Model: payload.model ?? "",
      Dimensions: payload.dimensions ?? "",
      Condition: payload.condition ?? "",
      Board_Type: payload.boardType ?? "",
      Section: payload.section ?? "",
      Alert_Kind: payload.alertKind ?? "",
      Saved_Search_Label: payload.savedSearchLabel ?? "",
      Search_Query: payload.searchQuery ?? "",
      Search_URL: payload.searchUrl ?? "",
      ...(payload.criteria ? boardAlertMatchFinderProperties(payload.criteria) : {}),
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
