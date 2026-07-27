import type { SupabaseClient } from "@supabase/supabase-js"
import { listBrandIdsMatchingProductCategories } from "@/lib/db/brand-product-categories"

const BRAND_ID_IN_CHUNK = 200
const MAX_CATALOG_BRANDS = 500

/** Directory brand row used for listing-photo brand extract + logo verify. */
export type BrandExtractCatalogRow = {
  id: string
  name: string
  slug: string
  logo_url: string | null
}

async function loadBrandExtractRowsByIds(
  supabase: SupabaseClient,
  brandIds: readonly string[],
): Promise<BrandExtractCatalogRow[]> {
  const uniqueIds = [...new Set(brandIds.filter(Boolean))]
  if (uniqueIds.length === 0) return []

  const out: BrandExtractCatalogRow[] = []

  for (let i = 0; i < uniqueIds.length; i += BRAND_ID_IN_CHUNK) {
    const chunk = uniqueIds.slice(i, i + BRAND_ID_IN_CHUNK)
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, slug, logo_url")
      .in("id", chunk)
      .order("name", { ascending: true })

    if (error) {
      console.error("loadBrandExtractRowsByIds:", error.message)
      break
    }

    for (const row of (data ?? []) as Array<{
      id: string
      name: string | null
      slug: string | null
      logo_url: string | null
    }>) {
      if (!row.id || !row.name?.trim() || !row.slug?.trim()) continue
      out.push({
        id: row.id,
        name: row.name.trim(),
        slug: row.slug.trim(),
        logo_url: row.logo_url?.trim() || null,
      })
    }
  }

  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Surfboard brands for photo extract prompts (name/slug allow-list) and logo verify.
 * Caps at MAX_CATALOG_BRANDS to keep the vision prompt bounded.
 */
export async function listSurfboardBrandsForPhotoExtract(
  supabase: SupabaseClient,
): Promise<BrandExtractCatalogRow[]> {
  const brandIds = await listBrandIdsMatchingProductCategories(supabase, ["surfboards"])
  if (!brandIds?.length) {
    // Fallback: directory brands without category tags still exist in older data.
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, slug, logo_url")
      .order("name", { ascending: true })
      .limit(MAX_CATALOG_BRANDS)

    if (error) {
      console.error("listSurfboardBrandsForPhotoExtract fallback:", error.message)
      return []
    }

    return ((data ?? []) as Array<{
      id: string
      name: string | null
      slug: string | null
      logo_url: string | null
    }>)
      .filter((row) => row.id && row.name?.trim() && row.slug?.trim())
      .map((row) => ({
        id: row.id,
        name: row.name!.trim(),
        slug: row.slug!.trim(),
        logo_url: row.logo_url?.trim() || null,
      }))
  }

  const rows = await loadBrandExtractRowsByIds(supabase, brandIds)
  return rows.slice(0, MAX_CATALOG_BRANDS)
}
