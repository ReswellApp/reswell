import type { SupabaseClient } from "@supabase/supabase-js"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import { listBrandProductCategoriesByBrandIds } from "@/lib/db/brand-product-categories"
import {
  isSellCatalogSearchCategory,
  SELL_CATALOG_SEARCH_CATEGORIES,
  type SellCatalogSearchBrandRow,
  type SellCatalogSearchCategory,
  type SellCatalogSearchModelRow,
} from "@/lib/types/sell-catalog-search"

const MODEL_SELECT = `
  id,
  name,
  description,
  image_url,
  product_category_slug,
  board_category_slug,
  brands:brand_id ( id, name, slug, logo_url )
`

type RawJoinedBrand = { id: string; name: string; slug: string; logo_url: string | null }

type RawModelRow = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  product_category_slug: BrandProductCategorySlug
  board_category_slug: string | null
  brands: RawJoinedBrand | RawJoinedBrand[] | null
}

function pickJoinedBrand(joined: RawModelRow["brands"]): RawJoinedBrand | null {
  if (!joined) return null
  return Array.isArray(joined) ? joined[0] ?? null : joined
}

function escapeIlikeToken(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[%_]/g, "")
}

function mapRow(row: RawModelRow): SellCatalogSearchModelRow | null {
  const brand = pickJoinedBrand(row.brands)
  if (!brand?.id || !brand.slug?.trim()) return null
  if (!isSellCatalogSearchCategory(row.product_category_slug)) return null
  return {
    kind: "model",
    id: row.id,
    name: row.name.trim(),
    brandId: brand.id,
    brandName: brand.name.trim(),
    brandSlug: brand.slug.trim(),
    brandLogoUrl: brand.logo_url?.trim() || null,
    imageUrl: row.image_url?.trim() || null,
    description: row.description?.trim() || null,
    category: row.product_category_slug,
    boardCategorySlug: row.board_category_slug?.trim() || null,
  }
}

/**
 * Cross-category `brand_models` search for the `/sell` catalog wall.
 * Matches model names directly plus all models of brands whose name matches.
 */
export async function searchSellCatalogModelRows(
  supabase: SupabaseClient,
  qRaw: string,
  categories: readonly SellCatalogSearchCategory[],
  limit = 30,
): Promise<SellCatalogSearchModelRow[]> {
  const q = qRaw.trim()
  if (q.length < 1 || categories.length === 0) return []

  const safe = escapeIlikeToken(q)
  if (!safe) return []
  const pattern = q.length < 4 ? `${safe}%` : `%${safe}%`
  const cats = [...categories]

  const [byModelName, matchingBrands] = await Promise.all([
    supabase
      .from("brand_models")
      .select(MODEL_SELECT)
      .ilike("name", pattern)
      .in("product_category_slug", cats)
      .order("name", { ascending: true })
      .limit(limit),
    supabase.from("brands").select("id").ilike("name", pattern).limit(10),
  ])

  if (byModelName.error) {
    console.error("searchSellCatalogModelRows (models):", byModelName.error.message)
  }
  if (matchingBrands.error) {
    console.error("searchSellCatalogModelRows (brands):", matchingBrands.error.message)
  }

  const brandIds = ((matchingBrands.data ?? []) as { id: string }[]).map((b) => b.id)

  let byBrand: RawModelRow[] = []
  if (brandIds.length > 0) {
    const { data, error } = await supabase
      .from("brand_models")
      .select(MODEL_SELECT)
      .in("brand_id", brandIds)
      .in("product_category_slug", cats)
      .order("name", { ascending: true })
      .limit(limit)
    if (error) {
      console.error("searchSellCatalogModelRows (brand models):", error.message)
    } else {
      byBrand = (data ?? []) as unknown as RawModelRow[]
    }
  }

  const merged = new Map<string, SellCatalogSearchModelRow>()
  for (const raw of [
    ...(((byModelName.data ?? []) as unknown) as RawModelRow[]),
    ...byBrand,
  ]) {
    const row = mapRow(raw)
    if (row && !merged.has(row.id)) merged.set(row.id, row)
  }

  return [...merged.values()].slice(0, limit)
}

/**
 * Every catalog model for one brand (searchable categories only) — powers the
 * `/sell` trending-brand drill-in ("Which {brand} model is it?").
 */
export async function listSellCatalogModelRowsByBrandId(
  supabase: SupabaseClient,
  brandId: string,
  categories: readonly SellCatalogSearchCategory[],
  limit = 120,
): Promise<SellCatalogSearchModelRow[]> {
  return listSellCatalogModelRowsByBrandIds(supabase, [brandId], categories, limit)
}

/**
 * Catalog models for one or more brands (sell categories only). Used to
 * backfill models after Elasticsearch brand hits so newly-imported rows that
 * are not yet in `reswell_sell_catalog` still appear in `/sell` search.
 */
export async function listSellCatalogModelRowsByBrandIds(
  supabase: SupabaseClient,
  brandIds: readonly string[],
  categories: readonly SellCatalogSearchCategory[],
  limit = 120,
): Promise<SellCatalogSearchModelRow[]> {
  if (brandIds.length === 0 || categories.length === 0) return []

  const { data, error } = await supabase
    .from("brand_models")
    .select(MODEL_SELECT)
    .in("brand_id", [...brandIds])
    .in("product_category_slug", [...categories])
    .order("name", { ascending: true })
    .limit(limit)

  if (error) {
    console.error("listSellCatalogModelRowsByBrandIds:", error.message)
    return []
  }

  return ((data ?? []) as unknown as RawModelRow[])
    .map(mapRow)
    .filter((row): row is SellCatalogSearchModelRow => row !== null)
}

function pickSellCategoryForBrand(
  slugs: readonly BrandProductCategorySlug[],
  allowed: readonly SellCatalogSearchCategory[],
): SellCatalogSearchCategory | null {
  for (const slug of SELL_CATALOG_SEARCH_CATEGORIES) {
    if (allowed.includes(slug) && slugs.includes(slug)) return slug
  }
  return null
}

/** Brand name matches scoped to sell categories (for suggestion rows). */
export async function searchSellCatalogBrandRows(
  supabase: SupabaseClient,
  qRaw: string,
  categories: readonly SellCatalogSearchCategory[],
  limit = 8,
): Promise<SellCatalogSearchBrandRow[]> {
  const q = qRaw.trim()
  if (q.length < 1 || categories.length === 0) return []

  const safe = escapeIlikeToken(q)
  if (!safe) return []
  const pattern = q.length < 4 ? `${safe}%` : `%${safe}%`

  const { data, error } = await supabase
    .from("brands")
    .select("id, name, slug, logo_url, short_description")
    .ilike("name", pattern)
    .order("name", { ascending: true })
    .limit(limit * 2)

  if (error) {
    console.error("searchSellCatalogBrandRows:", error.message)
    return []
  }

  const rawBrands = (data ?? []) as {
    id: string
    name: string
    slug: string
    logo_url: string | null
    short_description: string | null
  }[]

  if (rawBrands.length === 0) return []

  const categoryMap = await listBrandProductCategoriesByBrandIds(
    supabase,
    rawBrands.map((b) => b.id),
  )

  const out: SellCatalogSearchBrandRow[] = []
  for (const brand of rawBrands) {
    const category = pickSellCategoryForBrand(categoryMap.get(brand.id) ?? [], categories)
    if (!category) continue
    out.push({
      kind: "brand",
      id: brand.id,
      name: brand.name.trim(),
      slug: brand.slug.trim(),
      logoUrl: brand.logo_url?.trim() || null,
      shortDescription: brand.short_description?.trim() || null,
      category,
    })
    if (out.length >= limit) break
  }

  return out
}

/** Hydrate sell catalog model rows for Elasticsearch hits (order preserved by caller). */
export async function getSellCatalogModelRowsByIds(
  supabase: SupabaseClient,
  ids: readonly string[],
  categories: readonly SellCatalogSearchCategory[],
): Promise<SellCatalogSearchModelRow[]> {
  if (ids.length === 0 || categories.length === 0) return []

  const { data, error } = await supabase
    .from("brand_models")
    .select(MODEL_SELECT)
    .in("id", [...ids])
    .in("product_category_slug", [...categories])

  if (error) {
    console.error("getSellCatalogModelRowsByIds:", error.message)
    return []
  }

  const out: SellCatalogSearchModelRow[] = []
  for (const raw of (data ?? []) as unknown as RawModelRow[]) {
    const row = mapRow(raw)
    if (row) out.push(row)
  }
  return out
}

/** Hydrate sell catalog brand rows for Elasticsearch hits (order preserved by caller). */
export async function getSellCatalogBrandRowsByIds(
  supabase: SupabaseClient,
  ids: readonly string[],
  categories: readonly SellCatalogSearchCategory[],
): Promise<SellCatalogSearchBrandRow[]> {
  if (ids.length === 0 || categories.length === 0) return []

  const { data, error } = await supabase
    .from("brands")
    .select("id, name, slug, logo_url, short_description")
    .in("id", [...ids])

  if (error) {
    console.error("getSellCatalogBrandRowsByIds:", error.message)
    return []
  }

  const rawBrands = (data ?? []) as {
    id: string
    name: string
    slug: string
    logo_url: string | null
    short_description: string | null
  }[]
  if (rawBrands.length === 0) return []

  const categoryMap = await listBrandProductCategoriesByBrandIds(
    supabase,
    rawBrands.map((b) => b.id),
  )

  const out: SellCatalogSearchBrandRow[] = []
  for (const brand of rawBrands) {
    if (!brand.slug?.trim()) continue
    const category = pickSellCategoryForBrand(categoryMap.get(brand.id) ?? [], categories)
    if (!category) continue
    out.push({
      kind: "brand",
      id: brand.id,
      name: brand.name.trim(),
      slug: brand.slug.trim(),
      logoUrl: brand.logo_url?.trim() || null,
      shortDescription: brand.short_description?.trim() || null,
      category,
    })
  }
  return out
}

/** Broader model name search for similar-results fallback (non-fin categories). */
export async function searchSellCatalogModelRowsBroad(
  supabase: SupabaseClient,
  qRaw: string,
  categories: readonly SellCatalogSearchCategory[],
  limit = 20,
): Promise<SellCatalogSearchModelRow[]> {
  const q = qRaw.trim()
  if (q.length < 1 || categories.length === 0) return []

  const safe = escapeIlikeToken(q)
  if (!safe) return []
  const pattern = `%${safe}%`

  const { data, error } = await supabase
    .from("brand_models")
    .select(MODEL_SELECT)
    .ilike("name", pattern)
    .in("product_category_slug", [...categories])
    .order("name", { ascending: true })
    .limit(limit)

  if (error) {
    console.error("searchSellCatalogModelRowsBroad:", error.message)
    return []
  }

  const out: SellCatalogSearchModelRow[] = []
  for (const raw of (data ?? []) as unknown as RawModelRow[]) {
    const row = mapRow(raw)
    if (row) out.push(row)
  }
  return out
}
