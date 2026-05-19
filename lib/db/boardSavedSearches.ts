import type { SupabaseClient } from "@supabase/supabase-js"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

export type BoardSavedSearchRow = {
  id: string
  user_id: string
  label: string | null
  criteria: BoardSavedSearchCriteria
  email_notifications_enabled: boolean
  created_at: string
  updated_at: string
}

export async function insertBoardSavedSearch(
  supabase: SupabaseClient,
  userId: string,
  input: {
    criteria: BoardSavedSearchCriteria
    email_notifications_enabled: boolean
    label?: string | null
  },
): Promise<{ data: BoardSavedSearchRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("board_saved_searches")
    .insert({
      user_id: userId,
      criteria: input.criteria as Record<string, unknown>,
      email_notifications_enabled: input.email_notifications_enabled,
      label: input.label?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .select("id, user_id, label, criteria, email_notifications_enabled, created_at, updated_at")
    .maybeSingle()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: data as BoardSavedSearchRow | null, error: null }
}

export async function countBoardSavedSearchesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ count: number; error: Error | null }> {
  const { count, error } = await supabase
    .from("board_saved_searches")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)

  if (error) {
    return { count: 0, error: new Error(error.message) }
  }

  return { count: count ?? 0, error: null }
}

export async function fetchBoardSavedSearchesForUser(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
): Promise<{ data: BoardSavedSearchRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("board_saved_searches")
    .select("id, user_id, label, criteria, email_notifications_enabled, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    return { data: [], error: new Error(error.message) }
  }

  return { data: (data ?? []) as BoardSavedSearchRow[], error: null }
}

export async function deleteBoardSavedSearchForUser(
  supabase: SupabaseClient,
  userId: string,
  savedSearchId: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("board_saved_searches")
    .delete()
    .eq("id", savedSearchId)
    .eq("user_id", userId)

  if (error) {
    return { error: new Error(error.message) }
  }

  return { error: null }
}

export async function fetchBoardSavedSearchesWithEmailEnabled(
  service: SupabaseClient,
): Promise<{ data: BoardSavedSearchRow[]; error: Error | null }> {
  const { data, error } = await service
    .from("board_saved_searches")
    .select("id, user_id, label, criteria, email_notifications_enabled, created_at, updated_at")
    .eq("email_notifications_enabled", true)

  if (error) {
    return { data: [], error: new Error(error.message) }
  }

  return { data: (data ?? []) as BoardSavedSearchRow[], error: null }
}

export async function tryInsertBoardSavedSearchAlertSent(
  service: SupabaseClient,
  savedSearchId: string,
  listingId: string,
): Promise<{ inserted: boolean; error: Error | null }> {
  const { error } = await service.from("board_saved_search_alert_sent").insert({
    saved_search_id: savedSearchId,
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
