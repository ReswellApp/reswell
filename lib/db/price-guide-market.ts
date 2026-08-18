import type { SupabaseClient } from "@supabase/supabase-js"
import type { PriceGuideCategorySlug } from "@/lib/price-guide/categories"

const FETCH_PAGE = 1000
const FETCH_CAP = 4000

export type PriceGuideListingRow = {
  id: string
  slug: string | null
  title: string | null
  section: string
  status: string
  price: number | string | null
  condition: string | null
  dimensions: string | null
  brand: string | null
  model: string | null
  brand_id: string | null
  brand_model_id: string | null
  city: string | null
  state: string | null
  sold_off_platform: boolean | null
  sold_off_platform_at: string | null
  updated_at: string | null
  hidden_from_site: boolean | null
}

export type PriceGuideOrderRow = {
  id: string
  listing_id: string
  amount: number | string | null
  created_at: string
  refunded_at: string | null
  status: string | null
}

export type PriceGuideSnapshotRow = {
  listing_id: string
  brand_id: string | null
  catalog_brand_slug: string | null
  catalog_model_slug: string | null
  model_name: string | null
  condition: string | null
  sold_price: number | string | null
}

export type PriceGuideBrandLite = {
  id: string
  name: string
  slug: string
  logo_url: string | null
}

export type PriceGuideModelLite = {
  id: string
  brand_id: string
  name: string
  product_category_slug: string | null
  image_url: string | null
}

const LISTING_SELECT =
  "id, slug, title, section, status, price, condition, dimensions, brand, model, brand_id, brand_model_id, city, state, sold_off_platform, sold_off_platform_at, updated_at, hidden_from_site"

async function fetchPaged<T>(
  run: (from: number, to: number) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; from < FETCH_CAP; from += FETCH_PAGE) {
    const page = await run(from, from + FETCH_PAGE - 1)
    rows.push(...page)
    if (page.length < FETCH_PAGE) break
  }
  return rows
}

export async function selectPriceGuideListings(
  supabase: SupabaseClient,
  filters?: { section?: PriceGuideCategorySlug; brandId?: string },
): Promise<PriceGuideListingRow[]> {
  return fetchPaged(async (from, to) => {
    let query = supabase
      .from("listings")
      .select(LISTING_SELECT)
      .eq("hidden_from_site", false)
      .in("status", ["active", "sold", "pending_sale"])
      .order("updated_at", { ascending: false })
      .range(from, to)

    if (filters?.section) query = query.eq("section", filters.section)
    if (filters?.brandId) query = query.eq("brand_id", filters.brandId)

    const { data, error } = await query
    if (error || !data) {
      if (error) console.error("[price-guide] listings:", error.message)
      return []
    }
    return data as PriceGuideListingRow[]
  })
}

export async function selectPriceGuideOrdersForListingIds(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<PriceGuideOrderRow[]> {
  if (listingIds.length === 0) return []

  const chunks: string[][] = []
  for (let i = 0; i < listingIds.length; i += 200) {
    chunks.push(listingIds.slice(i, i + 200))
  }

  const rows: PriceGuideOrderRow[] = []
  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, listing_id, amount, created_at, refunded_at, status")
      .in("listing_id", chunk)
      .eq("status", "confirmed")
      .is("refunded_at", null)
      .order("created_at", { ascending: false })
      .limit(800)

    if (error) {
      console.error("[price-guide] orders:", error.message)
      continue
    }
    rows.push(...((data ?? []) as PriceGuideOrderRow[]))
  }
  return rows
}

export async function selectPriceGuideSnapshotsForListingIds(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<PriceGuideSnapshotRow[]> {
  if (listingIds.length === 0) return []

  const chunks: string[][] = []
  for (let i = 0; i < listingIds.length; i += 200) {
    chunks.push(listingIds.slice(i, i + 200))
  }

  const rows: PriceGuideSnapshotRow[] = []
  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("user_listing_board_model_data")
      .select(
        "listing_id, brand_id, catalog_brand_slug, catalog_model_slug, model_name, condition, sold_price",
      )
      .in("listing_id", chunk)
      .limit(800)

    if (error) {
      console.error("[price-guide] snapshots:", error.message)
      continue
    }
    rows.push(...((data ?? []) as PriceGuideSnapshotRow[]))
  }
  return rows
}

export async function selectPriceGuideBrandsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<PriceGuideBrandLite[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, slug, logo_url")
    .in("id", ids)
    .limit(800)

  if (error || !data) {
    if (error) console.error("[price-guide] brands:", error.message)
    return []
  }
  return data as PriceGuideBrandLite[]
}

export async function selectPriceGuideModelsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<PriceGuideModelLite[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from("brand_models")
    .select("id, brand_id, name, product_category_slug, image_url")
    .in("id", ids)
    .limit(800)

  if (error || !data) {
    if (error) console.error("[price-guide] models:", error.message)
    return []
  }
  return data as PriceGuideModelLite[]
}

export async function selectPriceGuideModelsForBrand(
  supabase: SupabaseClient,
  brandId: string,
): Promise<PriceGuideModelLite[]> {
  const { data, error } = await supabase
    .from("brand_models")
    .select("id, brand_id, name, product_category_slug, image_url")
    .eq("brand_id", brandId)
    .order("name", { ascending: true })
    .limit(400)

  if (error || !data) {
    if (error) console.error("[price-guide] brand models:", error.message)
    return []
  }
  return data as PriceGuideModelLite[]
}

export async function searchPriceGuideCatalog(
  supabase: SupabaseClient,
  q: string,
): Promise<{
  brands: PriceGuideBrandLite[]
  models: Array<PriceGuideModelLite & { brand_name: string; brand_slug: string }>
}> {
  const pattern = `%${q.replace(/[%_]/g, "").trim()}%`
  const [{ data: brandRows, error: brandError }, { data: modelRows, error: modelError }] =
    await Promise.all([
      supabase
        .from("brands")
        .select("id, name, slug, logo_url")
        .ilike("name", pattern)
        .order("name", { ascending: true })
        .limit(20),
      supabase
        .from("brand_models")
        .select("id, brand_id, name, product_category_slug, image_url, brands:brand_id ( name, slug )")
        .ilike("name", pattern)
        .order("name", { ascending: true })
        .limit(30),
    ])

  if (brandError) console.error("[price-guide] catalog brands:", brandError.message)
  if (modelError) console.error("[price-guide] catalog models:", modelError.message)

  type Joined = PriceGuideModelLite & {
    brands: { name: string; slug: string } | { name: string; slug: string }[] | null
  }

  const models = ((modelRows ?? []) as Joined[]).map((row) => {
    const brand = Array.isArray(row.brands) ? row.brands[0] ?? null : row.brands
    return {
      id: row.id,
      brand_id: row.brand_id,
      name: row.name,
      product_category_slug: row.product_category_slug,
      image_url: row.image_url,
      brand_name: brand?.name ?? "Unknown brand",
      brand_slug: brand?.slug ?? "",
    }
  })

  return {
    brands: (brandRows ?? []) as PriceGuideBrandLite[],
    models,
  }
}

export type PriceGuideLiveListingRow = {
  id: string
  slug: string | null
  title: string | null
  price: number | string | null
  condition: string | null
  dimensions: string | null
  city: string | null
  state: string | null
  listing_images:
    | Array<{
        url?: string | null
        thumbnail_url?: string | null
        is_primary?: boolean | null
        sort_order?: number | null
      }>
    | null
}

export async function selectPriceGuideLiveListings(
  supabase: SupabaseClient,
  filters: { section: PriceGuideCategorySlug; brandId: string; listingIds?: string[] },
  limit = 8,
): Promise<PriceGuideLiveListingRow[]> {
  let query = supabase
    .from("listings")
    .select(
      "id, slug, title, price, condition, dimensions, city, state, listing_images (url, thumbnail_url, is_primary, sort_order)",
    )
    .eq("section", filters.section)
    .eq("brand_id", filters.brandId)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (filters.listingIds && filters.listingIds.length > 0) {
    query = query.in("id", filters.listingIds)
  }

  const { data, error } = await query
  if (error || !data) {
    if (error) console.error("[price-guide] live listings:", error.message)
    return []
  }
  return data as PriceGuideLiveListingRow[]
}
