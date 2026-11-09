import type { SupabaseClient } from "@supabase/supabase-js"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import { normalizeBrandProductCategorySlugs } from "@/lib/brand-product-categories"

type CategoryRow = {
  brand_id: string
  category_slug: BrandProductCategorySlug
}

const BRAND_ID_IN_CHUNK = 200
const CATEGORY_LIST_PAGE = 1000

export async function listBrandProductCategoriesByBrandIds(
  supabase: SupabaseClient,
  brandIds: readonly string[],
): Promise<Map<string, BrandProductCategorySlug[]>> {
  const out = new Map<string, BrandProductCategorySlug[]>()
  if (brandIds.length === 0) return out

  for (let i = 0; i < brandIds.length; i += BRAND_ID_IN_CHUNK) {
    const chunk = brandIds.slice(i, i + BRAND_ID_IN_CHUNK)
    const { data, error } = await supabase
      .from("brand_product_categories")
      .select("brand_id, category_slug")
      .in("brand_id", chunk)

    if (error) {
      console.error("listBrandProductCategoriesByBrandIds:", error.message)
      break
    }

    for (const row of (data ?? []) as CategoryRow[]) {
      const existing = out.get(row.brand_id) ?? []
      existing.push(row.category_slug)
      out.set(row.brand_id, existing)
    }
  }

  for (const [brandId, slugs] of out) {
    out.set(brandId, normalizeBrandProductCategorySlugs(slugs))
  }

  return out
}

export async function listBrandIdsMatchingProductCategories(
  supabase: SupabaseClient,
  categories: readonly BrandProductCategorySlug[],
): Promise<string[] | null> {
  if (categories.length === 0) return null

  const ids = new Set<string>()
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from("brand_product_categories")
      .select("brand_id")
      .in("category_slug", [...categories])
      .order("brand_id", { ascending: true })
      .range(from, from + CATEGORY_LIST_PAGE - 1)

    if (error) {
      console.error("listBrandIdsMatchingProductCategories:", error.message)
      return [...ids]
    }

    const rows = (data ?? []) as { brand_id: string }[]
    for (const row of rows) {
      if (row.brand_id) ids.add(row.brand_id)
    }
    if (rows.length < CATEGORY_LIST_PAGE) break
    from += CATEGORY_LIST_PAGE
  }

  return [...ids]
}

export async function syncBrandProductCategories(
  supabase: SupabaseClient,
  brandId: string,
  categories: readonly BrandProductCategorySlug[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeBrandProductCategorySlugs(categories)

  const { error: deleteError } = await supabase
    .from("brand_product_categories")
    .delete()
    .eq("brand_id", brandId)

  if (deleteError) {
    console.error("syncBrandProductCategories delete:", deleteError.message)
    return { ok: false, error: deleteError.message }
  }

  if (normalized.length === 0) return { ok: true }

  const { error: insertError } = await supabase.from("brand_product_categories").insert(
    normalized.map((category_slug) => ({
      brand_id: brandId,
      category_slug,
    })),
  )

  if (insertError) {
    console.error("syncBrandProductCategories insert:", insertError.message)
    return { ok: false, error: insertError.message }
  }

  return { ok: true }
}
