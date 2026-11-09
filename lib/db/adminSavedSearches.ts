import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdminSavedSearchKind, AdminSavedSearchSectionFilter } from "@/lib/utils/admin-saved-search-query"
import { buildAdminSavedSearchOrFilter } from "@/lib/utils/admin-saved-search-query"
import { pageUntilExhausted } from "@/lib/utils/page-until-exhausted"

const SAVED_SEARCH_SELECT =
  "id, user_id, label, criteria, section, category_id, email_notifications_enabled, created_at, updated_at"

const PROFILE_MATCH_CAP = 200
const UNIQUE_ACCOUNT_CAP = 10000

export interface AdminSavedSearchDbRow {
  id: string
  user_id: string
  label: string | null
  criteria: unknown
  section: string | null
  category_id: string | null
  email_notifications_enabled: boolean
  created_at: string
  updated_at: string
}

export interface AdminSavedSearchProfileRow {
  id: string
  email: string | null
  display_name: string | null
}

interface ListFilters {
  kind: AdminSavedSearchKind
  section: AdminSavedSearchSectionFilter
  orFilter: string | null
}

function withListFilters(
  query: ReturnType<ReturnType<SupabaseClient["from"]>["select"]>,
  filters: ListFilters,
) {
  let next = query
  if (filters.kind === "alerts") {
    next = next.eq("email_notifications_enabled", true)
  } else if (filters.kind === "saved") {
    next = next.eq("email_notifications_enabled", false)
  }
  if (filters.section === "any") {
    next = next.is("section", null)
  } else if (filters.section !== "all") {
    next = next.eq("section", filters.section)
  }
  if (filters.orFilter) {
    next = next.or(filters.orFilter)
  }
  return next
}

export async function findAdminSavedSearchProfileIds(
  supabase: SupabaseClient,
  query: string,
): Promise<{ ids: string[]; truncated: boolean; error: Error | null }> {
  const pattern = `%${query.replace(/ /g, "%")}%`
  const quoted = `"${pattern}"`
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .or(`email.ilike.${quoted},display_name.ilike.${quoted}`)
    .limit(PROFILE_MATCH_CAP + 1)

  if (error) {
    return { ids: [], truncated: false, error: new Error(error.message) }
  }

  const ids = (data ?? [])
    .map((row) => (row as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string")

  return {
    ids: ids.slice(0, PROFILE_MATCH_CAP),
    truncated: ids.length > PROFILE_MATCH_CAP,
    error: null,
  }
}

export async function countAdminSavedSearches(
  supabase: SupabaseClient,
  filters: ListFilters,
): Promise<{ count: number; error: Error | null }> {
  const query = withListFilters(
    supabase.from("saved_searches").select("id", { count: "exact", head: true }),
    filters,
  )
  const { count, error } = await query
  if (error) return { count: 0, error: new Error(error.message) }
  return { count: count ?? 0, error: null }
}

export async function listAdminSavedSearchRows(
  supabase: SupabaseClient,
  input: ListFilters & { from: number; to: number },
): Promise<{ rows: AdminSavedSearchDbRow[]; total: number; error: Error | null }> {
  const query = withListFilters(
    supabase.from("saved_searches").select(SAVED_SEARCH_SELECT, { count: "exact" }),
    input,
  )
    .order("updated_at", { ascending: false })
    .range(input.from, input.to)

  const { data, error, count } = await query
  if (error) return { rows: [], total: 0, error: new Error(error.message) }
  return {
    rows: (data ?? []) as AdminSavedSearchDbRow[],
    total: count ?? 0,
    error: null,
  }
}

export async function listAdminSavedSearchProfiles(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<{ profiles: AdminSavedSearchProfileRow[]; error: Error | null }> {
  if (userIds.length === 0) return { profiles: [], error: null }
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .in("id", userIds)

  if (error) return { profiles: [], error: new Error(error.message) }
  return { profiles: (data ?? []) as AdminSavedSearchProfileRow[], error: null }
}

export async function countAdminSavedSearchAlertsSent(
  supabase: SupabaseClient,
  savedSearchIds: string[],
): Promise<{ counts: Map<string, number>; error: Error | null }> {
  const counts = new Map<string, number>()
  if (savedSearchIds.length === 0) return { counts, error: null }

  try {
    const rows = await pageUntilExhausted(async (from, to) => {
      const { data, error } = await supabase
        .from("saved_search_alert_sent")
        .select("saved_search_id")
        .in("saved_search_id", savedSearchIds)
        .range(from, to)
      if (error) throw new Error(error.message)
      return (data ?? []) as { saved_search_id: string }[]
    })
    for (const row of rows) {
      counts.set(row.saved_search_id, (counts.get(row.saved_search_id) ?? 0) + 1)
    }
    return { counts, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not count alert emails"
    return { counts, error: new Error(message) }
  }
}

export async function countAdminSavedSearchAccounts(
  supabase: SupabaseClient,
): Promise<{ count: number; capped: boolean; error: Error | null }> {
  const ids: string[] = []
  let capped = false
  try {
    await pageUntilExhausted(async (from, to) => {
      if (capped) return []
      const { data, error } = await supabase
        .from("saved_searches")
        .select("user_id")
        .range(from, to)
      if (error) throw new Error(error.message)
      const page = (data ?? [])
        .map((row) => (row as { user_id?: unknown }).user_id)
        .filter((id): id is string => typeof id === "string")
      ids.push(...page)
      if (ids.length > UNIQUE_ACCOUNT_CAP) {
        capped = true
        return []
      }
      return page
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not count accounts"
    return { count: 0, capped: false, error: new Error(message) }
  }

  const sample = capped ? ids.slice(0, UNIQUE_ACCOUNT_CAP) : ids
  return { count: new Set(sample).size, capped, error: null }
}

export function adminSavedSearchListFilters(input: {
  query: string
  kind: AdminSavedSearchKind
  section: AdminSavedSearchSectionFilter
  userIds: string[]
}): ListFilters {
  return {
    kind: input.kind,
    section: input.section,
    orFilter: buildAdminSavedSearchOrFilter(input.query, input.userIds),
  }
}
