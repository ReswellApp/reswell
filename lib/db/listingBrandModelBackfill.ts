import type { SupabaseClient } from "@supabase/supabase-js"
import type { BrandMatchRow, ModelMatchRow } from "@/lib/utils/listing-brand-model-match"

/** Active surfboard listing missing a catalog brand and/or model link. */
export type BackfillListingRow = {
  id: string
  title: string | null
  brand: string | null
  brand_id: string | null
  model: string | null
  brand_model_id: string | null
}

const BACKFILL_LISTING_SELECT = "id, title, brand, brand_id, model, brand_model_id" as const
const LISTING_PAGE_SIZE = 500
const CATALOG_PAGE_SIZE = 1000

/**
 * Collect active, on-site surfboard listings that are missing a directory brand
 * (`brand_id`) or catalog model (`brand_model_id`), oldest first, up to `maxListings`.
 *
 * Rows are read in full before any mutation so attaching links mid-run can't shift
 * the paginated window and skip candidates.
 */
export async function collectActiveSurfboardListingsNeedingBrandOrModel(
  supabase: SupabaseClient,
  maxListings: number,
): Promise<{ rows: BackfillListingRow[]; capped: boolean }> {
  const rows: BackfillListingRow[] = []
  let from = 0
  let capped = false

  for (;;) {
    const limit = Math.min(LISTING_PAGE_SIZE, maxListings - rows.length)
    if (limit <= 0) {
      capped = true
      break
    }

    const { data, error } = await supabase
      .from("listings")
      .select(BACKFILL_LISTING_SELECT)
      .eq("section", "surfboards")
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .or("brand_id.is.null,brand_model_id.is.null")
      .order("created_at", { ascending: true })
      .range(from, from + limit - 1)

    if (error) {
      console.error("collectActiveSurfboardListingsNeedingBrandOrModel:", error.message)
      break
    }

    const batch = (data ?? []) as BackfillListingRow[]
    rows.push(...batch)

    if (batch.length < limit) break
    from += limit
  }

  return { rows, capped }
}

/** Every directory brand (id, name, slug) for in-memory title matching. */
export async function loadDirectoryBrandsForMatching(
  supabase: SupabaseClient,
): Promise<BrandMatchRow[]> {
  const out: BrandMatchRow[] = []
  let from = 0

  for (;;) {
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, slug")
      .order("name", { ascending: true })
      .range(from, from + CATALOG_PAGE_SIZE - 1)

    if (error) {
      console.error("loadDirectoryBrandsForMatching:", error.message)
      break
    }

    const batch = (data ?? []) as Array<{ id: string; name: string | null; slug: string | null }>
    for (const row of batch) {
      if (!row.id || !row.name?.trim()) continue
      out.push({ id: row.id, name: row.name.trim(), slug: row.slug?.trim() ?? null })
    }

    if (batch.length < CATALOG_PAGE_SIZE) break
    from += CATALOG_PAGE_SIZE
  }

  return out
}

/** All `brand_models` grouped by `brand_id` for brand-scoped title matching. */
export async function loadBrandModelsByBrandId(
  supabase: SupabaseClient,
): Promise<Map<string, ModelMatchRow[]>> {
  const byBrand = new Map<string, ModelMatchRow[]>()
  let from = 0

  for (;;) {
    const { data, error } = await supabase
      .from("brand_models")
      .select("id, brand_id, name")
      .order("name", { ascending: true })
      .range(from, from + CATALOG_PAGE_SIZE - 1)

    if (error) {
      console.error("loadBrandModelsByBrandId:", error.message)
      break
    }

    const batch = (data ?? []) as Array<{ id: string; brand_id: string | null; name: string | null }>
    for (const row of batch) {
      if (!row.id || !row.brand_id || !row.name?.trim()) continue
      const existing = byBrand.get(row.brand_id)
      const model: ModelMatchRow = { id: row.id, brand_id: row.brand_id, name: row.name.trim() }
      if (existing) {
        existing.push(model)
      } else {
        byBrand.set(row.brand_id, [model])
      }
    }

    if (batch.length < CATALOG_PAGE_SIZE) break
    from += CATALOG_PAGE_SIZE
  }

  return byBrand
}

export type ListingBrandModelPatch = {
  brand_id?: string
  brand?: string
  brand_model_id?: string
  model?: string
}

/** Write the matched brand/model link (and canonical labels) onto a listing. */
export async function applyListingBrandModelAttach(
  supabase: SupabaseClient,
  listingId: string,
  patch: ListingBrandModelPatch,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("listings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message }
  }
  if (!data) {
    return { ok: false, message: "Listing not found" }
  }
  return { ok: true }
}
