/**
 * Server-only: Klaviyo Events API — fires when a shopper saves a marketplace search.
 *
 * **Metric name in Klaviyo:** `Saved Search` — profile is the shopper
 * (`external_id` = Supabase user id).
 *
 * Use `{{ event.Search_URL }}` to open the saved search
 * (e.g. `https://www.reswell.app/search?q=roberts+5%2710`) and
 * `{{ event.Search_Query }}` for the raw keyword.
 *
 * `photo_url` is `https://www.reswell.app/media/listings/...` for the newest
 * listing in that search (empty when nothing matches — never the site logo
 * or the Supabase storage host). `Price`, `Title`,
 * `Listing_URL`, and `Listing_ID` describe that same listing.
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { boardAlertMatchFinderProperties } from "@/lib/klaviyo/board-alert-match-details"
import { savedSearchAbsoluteUrl } from "@/lib/klaviyo/saved-search-url"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { boardSavedSearchCriteriaSummary } from "@/lib/utils/board-saved-search-browse-url"
import type { SavedSearchHeroListing } from "@/lib/saved-search-hero"
import { inferSavedSearchAlertKind } from "@/lib/utils/saved-search-alert-kind"
import { resolveSavedSearchSection } from "@/lib/utils/peer-saved-search-criteria"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

export const SAVED_SEARCH_METRIC = "Saved Search"

export type KlaviyoSavedSearchPayload = {
  userId: string
  email?: string | null
  savedSearchId: string
  criteria: BoardSavedSearchCriteria
  label?: string | null
  emailNotificationsEnabled: boolean
  savedAt?: string | null
  /** Newest listing in the saved search, when one exists. */
  hero?: SavedSearchHeroListing | null
}

export async function trackKlaviyoSavedSearch(
  payload: KlaviyoSavedSearchPayload,
): Promise<Awaited<ReturnType<typeof sendKlaviyoServerEvent>>> {
  let email = payload.email?.trim() || null
  if (!email) {
    email = await getAuthEmailForUserId(payload.userId)
  }

  const query = payload.criteria.q?.trim() ?? ""
  const label = payload.label?.trim() || boardSavedSearchCriteriaSummary(payload.criteria)

  return sendKlaviyoServerEvent({
    metricName: SAVED_SEARCH_METRIC,
    profile: {
      external_id: payload.userId,
      email,
    },
    uniqueId: `saved-search-${payload.savedSearchId}`,
    properties: {
      time: payload.savedAt ?? new Date().toISOString(),
      Saved_Search_ID: payload.savedSearchId,
      Saved_Search_Label: label,
      Search_Query: query,
      Search_URL: savedSearchAbsoluteUrl(payload.criteria),
      Email_Alerts: payload.emailNotificationsEnabled,
      Section: resolveSavedSearchSection(payload.criteria),
      Alert_Kind: inferSavedSearchAlertKind(payload.criteria),
      ...boardAlertMatchFinderProperties(payload.criteria),
      Search_URL: savedSearchAbsoluteUrl(payload.criteria),
      Search_Query: query,
      Listing_ID: payload.hero?.id ?? "",
      Title: payload.hero?.title ?? "",
      Price: payload.hero?.price ?? "",
      Listing_URL: payload.hero?.listingUrl ?? "",
      photo_url: payload.hero?.klaviyoPhotoUrl ?? "",
    },
  })
}
