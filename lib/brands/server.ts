import type { SupabaseClient } from "@supabase/supabase-js"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import type { BrandRow } from "@/lib/brands/types"
import {
  listBrandIdsMatchingProductCategories,
  listBrandProductCategoriesByBrandIds,
} from "@/lib/db/brand-product-categories"
import { brandAboutParagraphs } from "@/lib/brands/page-content"

const BRAND_SELECT =
  "id, slug, brand_request_id, name, short_description, website_url, logo_url, founder_name, lead_shaper_name, location_label, model_count, about_paragraphs"

/** PostgREST returns at most ~1000 rows per request unless ranged. */
const BRAND_LIST_PAGE = 1000
const BRAND_ID_IN_CHUNK = 200

export type ListBrandsOptions = {
  /** When set, include brands tagged with at least one of these categories. */
  productCategories?: readonly BrandProductCategorySlug[]
}

type BrandRowFromDb = Omit<BrandRow, "product_categories" | "about_paragraphs"> & {
  about_paragraphs?: unknown
}

async function attachProductCategories(
  supabase: SupabaseClient,
  rows: BrandRowFromDb[],
): Promise<BrandRow[]> {
  if (rows.length === 0) return []
  const categoryMap = await listBrandProductCategoriesByBrandIds(
    supabase,
    rows.map((row) => row.id),
  )
  return rows.map((row) => ({
    ...row,
    about_paragraphs: brandAboutParagraphs(row.about_paragraphs),
    product_categories: categoryMap.get(row.id) ?? [],
  }))
}

async function listBrandRowsPage(
  supabase: SupabaseClient,
  from: number,
  to: number,
  brandIds?: readonly string[],
): Promise<BrandRowFromDb[] | "error"> {
  let query = supabase
    .from("brands")
    .select(BRAND_SELECT)
    .order("name", { ascending: true })
    .range(from, to)

  if (brandIds) query = query.in("id", [...brandIds])

  const { data, error } = await query
  if (error) {
    console.error("listBrands:", error.message)
    return "error"
  }
  return (data ?? []) as BrandRowFromDb[]
}

async function listAllBrandRows(
  supabase: SupabaseClient,
  brandIds?: readonly string[],
): Promise<BrandRowFromDb[]> {
  if (brandIds && brandIds.length === 0) return []

  const out: BrandRowFromDb[] = []

  if (brandIds && brandIds.length > BRAND_ID_IN_CHUNK) {
    for (let i = 0; i < brandIds.length; i += BRAND_ID_IN_CHUNK) {
      const chunk = brandIds.slice(i, i + BRAND_ID_IN_CHUNK)
      let from = 0
      for (;;) {
        const page = await listBrandRowsPage(
          supabase,
          from,
          from + BRAND_LIST_PAGE - 1,
          chunk,
        )
        if (page === "error") return out
        out.push(...page)
        if (page.length < BRAND_LIST_PAGE) break
        from += BRAND_LIST_PAGE
      }
    }
    out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    return out
  }

  let from = 0
  for (;;) {
    const page = await listBrandRowsPage(
      supabase,
      from,
      from + BRAND_LIST_PAGE - 1,
      brandIds,
    )
    if (page === "error") return out
    out.push(...page)
    if (page.length < BRAND_LIST_PAGE) break
    from += BRAND_LIST_PAGE
  }
  return out
}

export async function listBrands(
  supabase: SupabaseClient,
  options?: ListBrandsOptions,
): Promise<BrandRow[]> {
  let brandIds: readonly string[] | undefined
  if (options?.productCategories?.length) {
    const matching = await listBrandIdsMatchingProductCategories(
      supabase,
      options.productCategories,
    )
    if (!matching?.length) return []
    brandIds = matching
  }

  const rows = await listAllBrandRows(supabase, brandIds)
  return attachProductCategories(supabase, rows)
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

  const [brand] = await attachProductCategories(supabase, [data as BrandRowFromDb])
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

  const [brand] = await attachProductCategories(supabase, [data as BrandRowFromDb])
  return brand ?? null
}
