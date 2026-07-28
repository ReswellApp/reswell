import type { SupabaseClient } from "@supabase/supabase-js"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import {
  savedSearchCategoryIdColumn,
  savedSearchSectionColumn,
} from "@/lib/utils/saved-search-category"

export type SavedSearchRow = {
  id: string
  user_id: string
  label: string | null
  criteria: BoardSavedSearchCriteria
  section: string | null
  category_id: string | null
  email_notifications_enabled: boolean
  created_at: string
  updated_at: string
}

/** @deprecated Prefer {@link SavedSearchRow}. */
export type BoardSavedSearchRow = SavedSearchRow

const SAVED_SEARCH_SELECT =
  "id, user_id, label, criteria, section, category_id, email_notifications_enabled, created_at, updated_at"

export async function insertBoardSavedSearch(
  supabase: SupabaseClient,
  userId: string,
  input: {
    criteria: BoardSavedSearchCriteria
    email_notifications_enabled: boolean
    label?: string | null
  },
): Promise<{ data: SavedSearchRow | null; error: Error | null }> {
  const section = savedSearchSectionColumn(input.criteria)
  const categoryId = savedSearchCategoryIdColumn(input.criteria)

  const { data, error } = await supabase
    .from("saved_searches")
    .insert({
      user_id: userId,
      criteria: input.criteria as Record<string, unknown>,
      section,
      category_id: categoryId,
      email_notifications_enabled: input.email_notifications_enabled,
      label: input.label?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .select(SAVED_SEARCH_SELECT)
    .maybeSingle()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: data as SavedSearchRow | null, error: null }
}

export async function countBoardSavedSearchesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ count: number; error: Error | null }> {
  const { count, error } = await supabase
    .from("saved_searches")
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
): Promise<{ data: SavedSearchRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("saved_searches")
    .select(SAVED_SEARCH_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    return { data: [], error: new Error(error.message) }
  }

  return { data: (data ?? []) as SavedSearchRow[], error: null }
}

export async function deleteBoardSavedSearchForUser(
  supabase: SupabaseClient,
  userId: string,
  savedSearchId: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("saved_searches")
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
  options?: { section?: string | null },
): Promise<{ data: SavedSearchRow[]; error: Error | null }> {
  let query = service
    .from("saved_searches")
    .select(SAVED_SEARCH_SELECT)
    .eq("email_notifications_enabled", true)

  // Section-scoped alerts: include exact section matches + any-section (NULL) searches.
  if (options?.section) {
    query = query.or(`section.eq.${options.section},section.is.null`)
  }

  const { data, error } = await query

  if (error) {
    return { data: [], error: new Error(error.message) }
  }

  return { data: (data ?? []) as SavedSearchRow[], error: null }
}

export async function tryInsertBoardSavedSearchAlertSent(
  service: SupabaseClient,
  savedSearchId: string,
  listingId: string,
): Promise<{ inserted: boolean; error: Error | null }> {
  const { error } = await service.from("saved_search_alert_sent").insert({
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
