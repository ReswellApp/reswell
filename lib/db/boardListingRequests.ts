import type { SupabaseClient } from "@supabase/supabase-js"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import type { BoardListingRequestSource } from "@/lib/validations/boardListingRequest"

export type BoardListingRequestRow = {
  id: string
  user_id: string | null
  email: string
  query: string | null
  criteria: BoardSavedSearchCriteria
  source: BoardListingRequestSource
  status: string
  created_at: string
}

/**
 * Inserts a buyer demand-capture row. Uses the service-role client — the table is
 * locked down with RLS (no client access), so writes must go through the server.
 */
export async function insertBoardListingRequest(
  service: SupabaseClient,
  input: {
    userId: string | null
    email: string
    query: string | null
    criteria: BoardSavedSearchCriteria
    source: BoardListingRequestSource
  },
): Promise<{ data: BoardListingRequestRow | null; error: Error | null }> {
  const { data, error } = await service
    .from("board_listing_requests")
    .insert({
      user_id: input.userId,
      email: input.email,
      query: input.query?.trim() || null,
      criteria: input.criteria as Record<string, unknown>,
      source: input.source,
    })
    .select("id, user_id, email, query, criteria, source, status, created_at")
    .maybeSingle()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: data as BoardListingRequestRow | null, error: null }
}

/** Counts requests for an email within the last `windowHours` (abuse / spam guard). */
export async function countRecentBoardListingRequestsForEmail(
  service: SupabaseClient,
  email: string,
  windowHours: number,
): Promise<{ count: number; error: Error | null }> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()
  const { count, error } = await service
    .from("board_listing_requests")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", since)

  if (error) {
    return { count: 0, error: new Error(error.message) }
  }

  return { count: count ?? 0, error: null }
}

/**
 * True when the same email already submitted an identical (source + query) request
 * inside the window — lets us treat a re-submit as success without inserting a dupe.
 */
export async function hasDuplicateBoardListingRequest(
  service: SupabaseClient,
  input: {
    email: string
    query: string | null
    source: BoardListingRequestSource
    windowHours: number
  },
): Promise<{ duplicate: boolean; error: Error | null }> {
  const since = new Date(Date.now() - input.windowHours * 60 * 60 * 1000).toISOString()
  let builder = service
    .from("board_listing_requests")
    .select("id", { count: "exact", head: true })
    .eq("email", input.email)
    .eq("source", input.source)
    .gte("created_at", since)

  const normalizedQuery = input.query?.trim() || null
  builder = normalizedQuery ? builder.eq("query", normalizedQuery) : builder.is("query", null)

  const { count, error } = await builder
  if (error) {
    return { duplicate: false, error: new Error(error.message) }
  }

  return { duplicate: (count ?? 0) > 0, error: null }
}

/** Open demand-capture rows eligible for listing-match notifications. */
export async function fetchOpenBoardListingRequests(
  service: SupabaseClient,
): Promise<{ data: BoardListingRequestRow[]; error: Error | null }> {
  const { data, error } = await service
    .from("board_listing_requests")
    .select("id, user_id, email, query, criteria, source, status, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: true })

  if (error) {
    return { data: [], error: new Error(error.message) }
  }

  return { data: (data ?? []) as BoardListingRequestRow[], error: null }
}

export async function markBoardListingRequestFulfilled(
  service: SupabaseClient,
  requestId: string,
): Promise<{ error: Error | null }> {
  const { error } = await service
    .from("board_listing_requests")
    .update({ status: "fulfilled" })
    .eq("id", requestId)
    .eq("status", "open")

  if (error) {
    return { error: new Error(error.message) }
  }

  return { error: null }
}

export async function tryInsertBoardListingRequestAlertSent(
  service: SupabaseClient,
  requestId: string,
  listingId: string,
): Promise<{ inserted: boolean; error: Error | null }> {
  const { error } = await service.from("board_listing_request_alert_sent").insert({
    request_id: requestId,
    listing_id: listingId,
  })

  if (error) {
    if (error.code === "23505") {
      return { inserted: false, error: null }
    }
    return { inserted: false, error: new Error(error.message) }
  }

  return { inserted: true, error: null }
}
