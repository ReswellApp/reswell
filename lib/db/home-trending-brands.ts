import type { SupabaseClient } from "@supabase/supabase-js"

const JOIN_SELECT = `
  id,
  brand_id,
  sort_order,
  brands:brand_id ( id, slug, name, logo_url )
`

type RawCurationRow = {
  id: string
  brand_id: string
  sort_order: number
  brands:
    | { id: string; slug: string; name: string; logo_url: string | null }
    | { id: string; slug: string; name: string; logo_url: string | null }[]
    | null
}

function pickBrand(
  joined: RawCurationRow["brands"],
): { id: string; slug: string; name: string; logo_url: string | null } | null {
  if (!joined) return null
  return Array.isArray(joined) ? joined[0] ?? null : joined
}

export type HomeTrendingBrandRow = {
  id: string
  brand_id: string
  sort_order: number
  brand: { id: string; slug: string; name: string; logo_url: string | null }
}

function hydrate(row: RawCurationRow): HomeTrendingBrandRow | null {
  const b = pickBrand(row.brands)
  if (!b) return null
  return {
    id: row.id,
    brand_id: row.brand_id,
    sort_order: row.sort_order,
    brand: {
      id: b.id,
      slug: b.slug,
      name: b.name,
      logo_url: b.logo_url,
    },
  }
}

export async function listHomeTrendingBrandRows(
  supabase: SupabaseClient,
): Promise<HomeTrendingBrandRow[]> {
  const { data, error } = await supabase
    .from("home_trending_brands")
    .select(JOIN_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    console.error("listHomeTrendingBrandRows:", error.message)
    return []
  }

  return (data ?? [])
    .map((row) => hydrate(row as unknown as RawCurationRow))
    .filter((r): r is HomeTrendingBrandRow => r !== null)
}

export type HomeTrendingBrandSearchHit = {
  id: string
  slug: string
  name: string
  logo_url: string | null
  already_featured: boolean
}

const BRAND_PICKER_PAGE = 1000
const SEARCH_RESULTS_CAP = 500

type BrandPickerRow = {
  id: string
  slug: string
  name: string
  logo_url: string | null
}

/** Load every brand row (paged) — PostgREST returns at most ~1000 rows per request. */
async function listAllBrandsForPicker(
  supabase: SupabaseClient,
): Promise<BrandPickerRow[]> {
  const out: BrandPickerRow[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from("brands")
      .select("id, slug, name, logo_url")
      .order("name", { ascending: true })
      .range(from, from + BRAND_PICKER_PAGE - 1)

    if (error) {
      console.error("listAllBrandsForPicker:", error.message)
      return out
    }
    const page = (data ?? []) as BrandPickerRow[]
    out.push(...page)
    if (page.length < BRAND_PICKER_PAGE) break
    from += BRAND_PICKER_PAGE
  }
  return out
}

async function listSearchMatchingBrandsForPicker(
  supabase: SupabaseClient,
  q: string,
  cap: number,
): Promise<BrandPickerRow[]> {
  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`
  const maxRows = Math.min(Math.max(cap, 1), SEARCH_RESULTS_CAP)
  const { data, error } = await supabase
    .from("brands")
    .select("id, slug, name, logo_url")
    .ilike("name", like)
    .order("name", { ascending: true })
    .limit(maxRows)

  if (error) {
    console.error("listSearchMatchingBrandsForPicker:", error.message)
    return []
  }
  return (data ?? []) as BrandPickerRow[]
}

/**
 * Returns brands for the admin picker: the full directory when `query` is empty, or
 * `ilike` name matches when searching. `searchLimit` only applies to the non-empty case.
 * Featured state uses one small query on `home_trending_brands` (no huge `.in()` lists).
 */
export async function searchBrandsForTrendingPicker(
  supabase: SupabaseClient,
  query: string,
  searchLimit = 200,
): Promise<HomeTrendingBrandSearchHit[]> {
  const q = query.trim()

  const { data: featuredData, error: fErr } = await supabase
    .from("home_trending_brands")
    .select("brand_id")

  if (fErr) {
    console.error("searchBrandsForTrendingPicker (featured ids):", fErr.message)
  }
  const featured = new Set<string>(
    (featuredData ?? []).map((r) => String((r as { brand_id: string }).brand_id)),
  )

  const rows: BrandPickerRow[] = q
    ? await listSearchMatchingBrandsForPicker(supabase, q, searchLimit)
    : await listAllBrandsForPicker(supabase)

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    logo_url: r.logo_url,
    already_featured: featured.has(r.id),
  }))
}

async function readMaxSortOrder(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from("home_trending_brands")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error("readMaxSortOrder (home_trending_brands):", error.message)
    return -1
  }
  return typeof data?.sort_order === "number" ? data.sort_order : -1
}

export type InsertHomeTrendingBrandResult =
  | { ok: true; id: string }
  | { ok: false; error: string; alreadyExists?: boolean }

export async function insertHomeTrendingBrand(
  supabase: SupabaseClient,
  brandId: string,
): Promise<InsertHomeTrendingBrandResult> {
  const existing = await supabase
    .from("home_trending_brands")
    .select("id")
    .eq("brand_id", brandId)
    .maybeSingle()

  if (existing.error) {
    console.error("insertHomeTrendingBrand (lookup):", existing.error.message)
    return { ok: false, error: existing.error.message || "Lookup failed" }
  }
  if (existing.data?.id) {
    return {
      ok: false,
      error: "That brand is already in Trending brands",
      alreadyExists: true,
    }
  }

  const maxOrder = await readMaxSortOrder(supabase)
  const { data, error } = await supabase
    .from("home_trending_brands")
    .insert({ brand_id: brandId, sort_order: maxOrder + 1 })
    .select("id")
    .single()

  if (error) {
    console.error("insertHomeTrendingBrand (insert):", error.message)
    return { ok: false, error: error.message || "Insert failed" }
  }
  if (!data?.id) {
    return { ok: false, error: "No row returned" }
  }
  return { ok: true, id: String(data.id) }
}

export async function deleteHomeTrendingBrandRow(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("home_trending_brands")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    console.error("deleteHomeTrendingBrandRow:", error.message)
    return { ok: false, error: error.message || "Delete failed" }
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: "No row deleted (check id)" }
  }
  return { ok: true }
}
