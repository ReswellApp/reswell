import { mobileSavedSearchSchema, type MobileSavedSearch } from "@reswell/api-contract"
import { trackKlaviyoSavedSearch } from "@/lib/klaviyo/track-saved-search"
import {
  countBoardSavedSearchesForUser,
  deleteBoardSavedSearchForUser,
  fetchBoardSavedSearchesForUser,
  insertBoardSavedSearch,
} from "@/lib/db/savedSearches"
import { newestListingForSavedSearch } from "@/lib/services/newestSavedSearchListing"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { getDb } from "@/lib/supabase/db"
import { marketplaceSearchSavedCriteria } from "@/lib/utils/peer-saved-search-criteria"
import { matchingSavedSearchId } from "@/lib/utils/saved-search-criteria-equal"
import {
  BOARD_SAVED_SEARCHES_MAX,
  boardSavedCriteriaCanSaveFromEmptyState,
} from "@/lib/validations/boardSavedSearch"
import type { SupabaseClient, User } from "@supabase/supabase-js"

/** Whether this shopper already saved the same marketplace query the website would save. */
export async function getMobileSavedSearchService(
  supabase: SupabaseClient,
  userId: string,
  query: string,
): Promise<MobileApiResult<MobileSavedSearch>> {
  const criteria = marketplaceSearchSavedCriteria(query)
  const existing = await fetchBoardSavedSearchesForUser(supabase, userId, BOARD_SAVED_SEARCHES_MAX)
  if (existing.error) {
    return { ok: false, status: 500, error: "Unable to load saved searches right now" }
  }
  const parsed = mobileSavedSearchSchema.safeParse({
    saved_search_id: matchingSavedSearchId(existing.data, criteria),
  })
  if (!parsed.success) {
    return { ok: false, status: 500, error: "Unable to load saved searches right now" }
  }
  return { ok: true, data: parsed.data }
}

/** Save or remove the marketplace query, using the same criteria and email alert as the website. */
export async function setMobileSavedSearchService(
  supabase: SupabaseClient,
  user: User,
  query: string,
  saved: boolean,
): Promise<MobileApiResult<MobileSavedSearch>> {
  const criteria = marketplaceSearchSavedCriteria(query)
  if (!boardSavedCriteriaCanSaveFromEmptyState(criteria)) {
    return { ok: false, status: 400, error: "Choose a keyword before saving this search" }
  }

  const existing = await fetchBoardSavedSearchesForUser(supabase, user.id, BOARD_SAVED_SEARCHES_MAX)
  if (existing.error) {
    return { ok: false, status: 500, error: "Unable to update this saved search right now" }
  }
  const matchId = matchingSavedSearchId(existing.data, criteria)

  if (!saved) {
    if (!matchId) return { ok: true, data: { saved_search_id: null } }
    const removed = await deleteBoardSavedSearchForUser(supabase, user.id, matchId)
    if (removed.error) {
      return { ok: false, status: 500, error: "Unable to update this saved search right now" }
    }
    return { ok: true, data: { saved_search_id: null } }
  }

  if (matchId) return { ok: true, data: { saved_search_id: matchId } }

  const counted = await countBoardSavedSearchesForUser(supabase, user.id)
  if (counted.error) {
    return { ok: false, status: 500, error: "Unable to update this saved search right now" }
  }
  if (counted.count >= BOARD_SAVED_SEARCHES_MAX) {
    return {
      ok: false,
      status: 400,
      error: `You can save up to ${BOARD_SAVED_SEARCHES_MAX} searches. Remove one to add another.`,
    }
  }

  const inserted = await insertBoardSavedSearch(supabase, user.id, {
    criteria,
    email_notifications_enabled: true,
  })
  if (inserted.error || !inserted.data) {
    return { ok: false, status: 500, error: "Unable to update this saved search right now" }
  }

  const savedSearchId = inserted.data.id
  const savedAt = inserted.data.created_at
  void newestListingForSavedSearch(getDb({ consistency: "eventual", purpose: "catalog" }), criteria)
    .then((hero) =>
      trackKlaviyoSavedSearch({
        userId: user.id,
        email: user.email,
        savedSearchId,
        criteria,
        emailNotificationsEnabled: true,
        savedAt,
        hero,
      }),
    )
    .catch((error: unknown) => {
      console.error("[saved_search] Klaviyo Saved Search event failed", {
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      })
    })

  return { ok: true, data: { saved_search_id: savedSearchId } }
}
