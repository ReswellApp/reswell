/**
 * The Klaviyo metric `Saved Search` is not emitted.
 *
 * A flow on that metric sends "A new board matches your search" as soon as the
 * event arrives, and it still sends when Title and Price are empty. Saving a
 * search must not email. The match email is `Board Alert Match`, and only
 * after a listing goes live later than the search was saved.
 */

import type { SendKlaviyoServerEventResult } from "@/lib/klaviyo/send-event"
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
}

export async function trackKlaviyoSavedSearch(
  _payload: KlaviyoSavedSearchPayload,
): Promise<SendKlaviyoServerEventResult> {
  return {
    ok: false,
    status: 0,
    skipped: true,
    skipReason: "saved_search_does_not_email",
    detail: "Match email waits for a listing created after this search was saved.",
  }
}
