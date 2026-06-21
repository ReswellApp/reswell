import type { SupabaseClient } from "@supabase/supabase-js"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import { normalizeBrandProductCategorySlugs } from "@/lib/brand-product-categories"

type CategoryRow = {
  brand_id: string
  category_slug: BrandProductCategorySlug
}

export async function listBrandProductCategoriesByBrandIds(
  supabase: SupabaseClient,
  brandIds: readonly string[],
): Promise<Map<string, BrandProductCategorySlug[]>> {
  const out = new Map<string, BrandProductCategorySlug[]>()
  if (brandIds.length === 0) return out

  const { data, error } = await supabase
    .from("brand_product_categories")
    .select("brand_id, category_slug")
    .in("brand_id", [...brandIds])

  if (error) {
    console.error("listBrandProductCategoriesByBrandIds:", error.message)
    return out
  }

  for (const row of (data ?? []) as CategoryRow[]) {
    const existing = out.get(row.brand_id) ?? []
    existing.push(row.category_slug)
    out.set(row.brand_id, existing)
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

  const { data, error } = await supabase
    .from("brand_product_categories")
    .select("brand_id")
    .in("category_slug", [...categories])

  if (error) {
    console.error("listBrandIdsMatchingProductCategories:", error.message)
    return []
  }

  return [...new Set((data ?? []).map((row) => row.brand_id as string))]
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
