import type { SupabaseClient } from "@supabase/supabase-js"

export interface SurferSitemapEntry {
  path: string
}

/**
 * Surfer directory detail URLs (`/surfers/[slug]`).
 */
export async function fetchSurferSlugPathsForSitemap(supabase: SupabaseClient): Promise<SurferSitemapEntry[]> {
  const { data, error } = await supabase.from("surfers").select("slug").order("slug", { ascending: true })

  if (error) {
    console.error("[sitemap] surfers:", error.message)
    return []
  }

  const rows = (data ?? []) as { slug: string | null }[]
  return rows
    .map((r) => r.slug?.trim())
    .filter((s): s is string => Boolean(s))
    .map((slug) => ({ path: `/surfers/${slug}` }))
}
