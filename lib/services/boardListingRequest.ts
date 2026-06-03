import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  countRecentBoardListingRequestsForEmail,
  hasDuplicateBoardListingRequest,
  insertBoardListingRequest,
} from "@/lib/db/boardListingRequests"
import { trackKlaviyoBoardListingRequest } from "@/lib/klaviyo/track-board-listing-request"
import { boardSavedSearchCriteriaSummary } from "@/lib/utils/board-saved-search-browse-url"
import {
  BOARD_LISTING_REQUEST_DAILY_CAP,
  type BoardListingRequestSource,
} from "@/lib/validations/boardListingRequest"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

const DEDUPE_WINDOW_HOURS = 24

export type CaptureBoardListingRequestInput = {
  email: string
  query: string | null
  criteria: BoardSavedSearchCriteria
  source: BoardListingRequestSource
  /** Supabase user id when the requester is signed in. */
  userId: string | null
}

export type CaptureBoardListingRequestResult =
  | { ok: true; deduped: boolean }
  | { ok: false; error: string }

/**
 * Records buyer demand from a no-results search and (best-effort) fires the Klaviyo
 * `Board Listing Request` event so the shopper can be confirmed + re-engaged once supply lands.
 * Idempotent for an identical (email, source, query) inside a 24h window.
 */
export async function captureBoardListingRequest(
  input: CaptureBoardListingRequestInput,
): Promise<CaptureBoardListingRequestResult> {
  const service = createServiceRoleClient()

  const { count, error: countError } = await countRecentBoardListingRequestsForEmail(
    service,
    input.email,
    DEDUPE_WINDOW_HOURS,
  )
  if (countError) {
    console.error("[boardListingRequest] count failed:", countError.message)
    return { ok: false, error: "Could not submit your request. Try again." }
  }
  if (count >= BOARD_LISTING_REQUEST_DAILY_CAP) {
    return {
      ok: false,
      error: "You've sent several requests recently — we're on it. Try again tomorrow.",
    }
  }

  const { duplicate, error: dupeError } = await hasDuplicateBoardListingRequest(service, {
    email: input.email,
    query: input.query,
    source: input.source,
    windowHours: DEDUPE_WINDOW_HOURS,
  })
  if (dupeError) {
    console.error("[boardListingRequest] dedupe check failed:", dupeError.message)
  }
  if (duplicate) {
    return { ok: true, deduped: true }
  }

  const { error: insertError } = await insertBoardListingRequest(service, {
    userId: input.userId,
    email: input.email,
    query: input.query,
    criteria: input.criteria,
    source: input.source,
  })
  if (insertError) {
    console.error("[boardListingRequest] insert failed:", insertError.message)
    return { ok: false, error: "Could not submit your request. Try again." }
  }

  const summary = boardSavedSearchCriteriaSummary(input.criteria)
  try {
    await trackKlaviyoBoardListingRequest({
      email: input.email,
      requesterUserId: input.userId,
      query: input.query,
      summary,
      source: input.source,
      brand: input.criteria.brand ?? null,
      model: input.criteria.model ?? null,
      dimensions: input.criteria.dimensions ?? null,
      condition: input.criteria.condition ?? null,
      boardType: input.criteria.type ?? null,
    })
  } catch (e) {
    console.error("[boardListingRequest] Klaviyo event failed:", e)
  }

  return { ok: true, deduped: false }
}
