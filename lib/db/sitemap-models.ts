import type { SupabaseClient } from "@supabase/supabase-js"
import { isReservedModelPageBrandSegment, modelPageSlug } from "@/lib/models/routes"

export type ModelSitemapEntry = {
  brandSlug: string
  modelSlug: string
}

/**
 * Public `/[brand]/[model]` URLs from the catalog directory.
 */
export async function fetchBrandModelSitemapEntries(
  supabase: SupabaseClient,
): Promise<ModelSitemapEntry[]> {
  const { data, error } = await supabase
    .from("brand_models")
    .select("name, brands:brand_id ( slug )")
    .order("name", { ascending: true })
    .limit(4000)

  if (error) {
    console.error("[sitemap] brand models:", error.message)
    return []
  }

  const out: ModelSitemapEntry[] = []
  const seen = new Set<string>()
  for (const row of (data ?? []) as {
    name: string | null
    brands: { slug: string } | { slug: string }[] | null
  }[]) {
    const joined = row.brands
    const brandSlug = (Array.isArray(joined) ? joined[0]?.slug : joined?.slug)?.trim() ?? ""
    const modelSlug = row.name ? modelPageSlug(row.name) : ""
    if (!brandSlug || !modelSlug || isReservedModelPageBrandSegment(brandSlug)) continue
    const key = `${brandSlug}/${modelSlug}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ brandSlug, modelSlug })
  }
  return out
}
