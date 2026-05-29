import type { SupabaseClient } from "@supabase/supabase-js"

export interface SeoRedirectRow {
  id: string
  from_path: string
  to_path: string
  status_code: number
  enabled: boolean
  note: string | null
  hits: number
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type SeoRedirectWriteColumns = {
  from_path: string
  to_path: string
  status_code: number
  enabled: boolean
  note: string | null
}

export async function listSeoRedirects(supabase: SupabaseClient): Promise<SeoRedirectRow[]> {
  const { data, error } = await supabase
    .from("seo_redirects")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("listSeoRedirects:", error.message)
    return []
  }
  return (data ?? []) as SeoRedirectRow[]
}

export async function createSeoRedirect(
  supabase: SupabaseClient,
  cols: SeoRedirectWriteColumns,
  updatedBy: string | null,
): Promise<{ ok: true; row: SeoRedirectRow } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("seo_redirects")
    .insert({ ...cols, updated_by: updatedBy })
    .select("*")
    .single()

  if (error) {
    console.error("createSeoRedirect:", error.message)
    const dup = error.code === "23505"
    return { ok: false, error: dup ? "A redirect for that path already exists." : error.message }
  }
  return { ok: true, row: data as SeoRedirectRow }
}

export async function updateSeoRedirect(
  supabase: SupabaseClient,
  id: string,
  cols: SeoRedirectWriteColumns,
  updatedBy: string | null,
): Promise<{ ok: true; row: SeoRedirectRow } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("seo_redirects")
    .update({ ...cols, updated_by: updatedBy })
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    console.error("updateSeoRedirect:", error.message)
    const dup = error.code === "23505"
    return { ok: false, error: dup ? "A redirect for that path already exists." : error.message }
  }
  return { ok: true, row: data as SeoRedirectRow }
}

export async function deleteSeoRedirect(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("seo_redirects").delete().eq("id", id)
  if (error) {
    console.error("deleteSeoRedirect:", error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
