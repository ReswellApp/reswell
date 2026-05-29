import type { SupabaseClient } from "@supabase/supabase-js"
import type { PageSeoOverrideValues } from "@/lib/seo/types"

export interface PageSeoHistoryRow {
  id: string
  page_key: string
  action: "save" | "reset"
  snapshot: PageSeoOverrideValues
  changed_by: string | null
  created_at: string
}

export async function insertPageSeoHistory(
  supabase: SupabaseClient,
  pageKey: string,
  action: "save" | "reset",
  snapshot: PageSeoOverrideValues,
  changedBy: string | null,
): Promise<void> {
  const { error } = await supabase.from("page_seo_override_history").insert({
    page_key: pageKey,
    action,
    snapshot,
    changed_by: changedBy,
  })
  // History is best-effort — never block a save because the log write failed.
  if (error) console.error("insertPageSeoHistory:", error.message)
}

export async function listPageSeoHistory(
  supabase: SupabaseClient,
  pageKey: string,
  limit = 10,
): Promise<PageSeoHistoryRow[]> {
  const { data, error } = await supabase
    .from("page_seo_override_history")
    .select("*")
    .eq("page_key", pageKey)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("listPageSeoHistory:", error.message)
    return []
  }
  return (data ?? []) as PageSeoHistoryRow[]
}
