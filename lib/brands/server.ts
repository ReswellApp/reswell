import type { SupabaseClient } from "@supabase/supabase-js"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import type { BrandRow } from "@/lib/brands/types"
import {
  listBrandIdsMatchingProductCategories,
  listBrandProductCategoriesByBrandIds,
} from "@/lib/db/brand-product-categories"

const BRAND_SELECT =
  "id, slug, brand_request_id, name, short_description, website_url, logo_url, founder_name, lead_shaper_name, location_label, model_count"

export type ListBrandsOptions = {
  /** When set, include brands tagged with at least one of these categories. */
  productCategories?: readonly BrandProductCategorySlug[]
}

async function attachProductCategories(
  supabase: SupabaseClient,
  rows: Omit<BrandRow, "product_categories">[],
): Promise<BrandRow[]> {
  if (rows.length === 0) return []
  const categoryMap = await listBrandProductCategoriesByBrandIds(
    supabase,
    rows.map((row) => row.id),
  )
  return rows.map((row) => ({
    ...row,
    product_categories: categoryMap.get(row.id) ?? [],
  }))
}

export async function listBrands(
  supabase: SupabaseClient,
  options?: ListBrandsOptions,
): Promise<BrandRow[]> {
  let query = supabase.from("brands").select(BRAND_SELECT).order("name", { ascending: true })

  if (options?.productCategories?.length) {
    const brandIds = await listBrandIdsMatchingProductCategories(
      supabase,
      options.productCategories,
    )
    if (brandIds.length === 0) return []
    query = query.in("id", brandIds)
  }

  const { data, error } = await query

  if (error) {
    console.error("listBrands:", error.message)
    return []
  }

  return attachProductCategories(supabase, (data ?? []) as Omit<BrandRow, "product_categories">[])
}

export async function getBrandBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<BrandRow | null> {
  const { data, error } = await supabase
    .from("brands")
    .select(BRAND_SELECT)
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    console.error("getBrandBySlug:", error.message)
    return null
  }
  if (!data) return null

  const [brand] = await attachProductCategories(supabase, [
    data as Omit<BrandRow, "product_categories">,
  ])
  return brand ?? null
}

export async function getBrandById(
  supabase: SupabaseClient,
  id: string,
): Promise<BrandRow | null> {
  const { data, error } = await supabase
    .from("brands")
    .select(BRAND_SELECT)
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("getBrandById:", error.message)
    return null
  }
  if (!data) return null

  const [brand] = await attachProductCategories(supabase, [
    data as Omit<BrandRow, "product_categories">,
  ])
  return brand ?? null
}
