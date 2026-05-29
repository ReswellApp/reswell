import type { SupabaseClient } from "@supabase/supabase-js"

export interface PageSeoOverrideRow {
  id: string
  page_key: string
  title: string | null
  description: string | null
  keywords: string[] | null
  canonical_url: string | null
  robots_index: boolean | null
  robots_follow: boolean | null
  og_title: string | null
  og_description: string | null
  og_image_url: string | null
  og_type: "website" | "article" | null
  twitter_card: "summary" | "summary_large_image" | null
  twitter_title: string | null
  twitter_description: string | null
  twitter_image_url: string | null
  structured_data: unknown | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

/** Columns written by the admin upsert (excludes generated/id/timestamps). */
export type PageSeoOverrideWriteColumns = {
  title: string | null
  description: string | null
  keywords: string[] | null
  canonical_url: string | null
  robots_index: boolean | null
  robots_follow: boolean | null
  og_title: string | null
  og_description: string | null
  og_image_url: string | null
  og_type: "website" | "article" | null
  twitter_card: "summary" | "summary_large_image" | null
  twitter_title: string | null
  twitter_description: string | null
  twitter_image_url: string | null
  structured_data: unknown | null
}

export async function listPageSeoOverrides(
  supabase: SupabaseClient,
): Promise<PageSeoOverrideRow[]> {
  const { data, error } = await supabase
    .from("page_seo_overrides")
    .select("*")
    .order("page_key", { ascending: true })

  if (error) {
    console.error("listPageSeoOverrides:", error.message)
    return []
  }
  return (data ?? []) as PageSeoOverrideRow[]
}

export async function getPageSeoOverrideByKey(
  supabase: SupabaseClient,
  pageKey: string,
): Promise<PageSeoOverrideRow | null> {
  const { data, error } = await supabase
    .from("page_seo_overrides")
    .select("*")
    .eq("page_key", pageKey)
    .maybeSingle()

  if (error) {
    console.error("getPageSeoOverrideByKey:", error.message)
    return null
  }
  return (data as PageSeoOverrideRow | null) ?? null
}

/** True when every override column is empty — i.e. the row no longer overrides anything. */
function isEmptyOverride(cols: PageSeoOverrideWriteColumns): boolean {
  return (
    cols.title === null &&
    cols.description === null &&
    (cols.keywords === null || cols.keywords.length === 0) &&
    cols.canonical_url === null &&
    cols.robots_index === null &&
    cols.robots_follow === null &&
    cols.og_title === null &&
    cols.og_description === null &&
    cols.og_image_url === null &&
    cols.og_type === null &&
    cols.twitter_card === null &&
    cols.twitter_title === null &&
    cols.twitter_description === null &&
    cols.twitter_image_url === null &&
    cols.structured_data === null
  )
}

/**
 * Upsert an override for `pageKey`. If the payload clears every field, the row is deleted
 * so the page cleanly falls back to its code default.
 */
export async function upsertPageSeoOverride(
  supabase: SupabaseClient,
  pageKey: string,
  cols: PageSeoOverrideWriteColumns,
  updatedBy: string | null,
): Promise<{ ok: true; cleared: boolean } | { ok: false; error: string }> {
  if (isEmptyOverride(cols)) {
    const { error } = await supabase.from("page_seo_overrides").delete().eq("page_key", pageKey)
    if (error) {
      console.error("upsertPageSeoOverride(delete):", error.message)
      return { ok: false, error: error.message || "Could not clear override" }
    }
    return { ok: true, cleared: true }
  }

  const { error } = await supabase
    .from("page_seo_overrides")
    .upsert(
      { page_key: pageKey, updated_by: updatedBy, ...cols },
      { onConflict: "page_key" },
    )

  if (error) {
    console.error("upsertPageSeoOverride:", error.message)
    return { ok: false, error: error.message || "Could not save override" }
  }
  return { ok: true, cleared: false }
}

export async function deletePageSeoOverride(
  supabase: SupabaseClient,
  pageKey: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("page_seo_overrides").delete().eq("page_key", pageKey)
  if (error) {
    console.error("deletePageSeoOverride:", error.message)
    return { ok: false, error: error.message || "Could not reset page" }
  }
  return { ok: true }
}
