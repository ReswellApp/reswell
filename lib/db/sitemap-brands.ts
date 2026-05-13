import type { SupabaseClient } from "@supabase/supabase-js"

export interface BrandSitemapEntry {
  slug: string
}

/**
 * Brand profile URLs (`/brands/[slug]`).
 */
export async function fetchBrandSlugRowsForSitemap(supabase: SupabaseClient): Promise<BrandSitemapEntry[]> {
  const { data, error } = await supabase.from("brands").select("slug").order("slug", { ascending: true })

  if (error) {
    console.error("[sitemap] brands:", error.message)
    return []
  }

  const rows = (data ?? []) as { slug: string | null }[]
  return rows
    .map((r) => r.slug?.trim())
    .filter((s): s is string => Boolean(s))
    .map((slug) => ({ slug }))
}
