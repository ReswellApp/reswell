import type { SupabaseClient } from "@supabase/supabase-js"
import { FIN_CATALOG_PRODUCT_CATEGORY } from "@/lib/brand-catalog-fin-variants"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import { listBrandIdsMatchingProductCategories } from "@/lib/db/brand-product-categories"
import type { BrandMatchRow, ModelMatchRow } from "@/lib/utils/listing-brand-model-match"

/** Peer listing sections the brand/model backfill cron processes. */
export type ListingBrandModelBackfillSection = "surfboards" | "fins"

/** Active listing missing a catalog brand and/or model link. */
export type BackfillListingRow = {
  id: string
  title: string | null
  brand: string | null
  brand_id: string | null
  model: string | null
  brand_model_id: string | null
  section: ListingBrandModelBackfillSection
}

const BACKFILL_LISTING_SELECT = "id, title, brand, brand_id, model, brand_model_id, section" as const
const LISTING_PAGE_SIZE = 500
const CATALOG_PAGE_SIZE = 1000
const BRAND_ID_IN_CHUNK = 200

/**
 * Collect active, on-site listings in `section` that are missing a directory brand
 * (`brand_id`) or catalog model (`brand_model_id`), oldest first, up to `maxListings`.
 *
 * Rows are read in full before any mutation so attaching links mid-run can't shift
 * the paginated window and skip candidates.
 */
export async function collectActiveListingsNeedingBrandOrModel(
  supabase: SupabaseClient,
  section: ListingBrandModelBackfillSection,
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
      .eq("section", section)
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .or("brand_id.is.null,brand_model_id.is.null")
      .order("created_at", { ascending: true })
      .range(from, from + limit - 1)

    if (error) {
      console.error("collectActiveListingsNeedingBrandOrModel:", section, error.message)
      break
    }

    const batch = (data ?? []) as BackfillListingRow[]
    rows.push(...batch)

    if (batch.length < limit) break
    from += limit
  }

  return { rows, capped }
}

/** @deprecated Use {@link collectActiveListingsNeedingBrandOrModel} with section `surfboards`. */
export async function collectActiveSurfboardListingsNeedingBrandOrModel(
  supabase: SupabaseClient,
  maxListings: number,
): Promise<{ rows: BackfillListingRow[]; capped: boolean }> {
  return collectActiveListingsNeedingBrandOrModel(supabase, "surfboards", maxListings)
}

export type ListingBrandModelSectionCoverage = {
  activeListings: number
  missingEither: number
  missingBrand: number
  missingModel: number
}

/** Live coverage counts for surfboard and fin listings missing catalog links. */
export type ListingBrandModelCoverage = {
  surfboards: ListingBrandModelSectionCoverage
  fins: ListingBrandModelSectionCoverage
}

function activeListingCountQuery(
  supabase: SupabaseClient,
  section: ListingBrandModelBackfillSection,
) {
  return supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("section", section)
    .eq("status", "active")
    .eq("hidden_from_site", false)
}

async function getSectionListingBrandModelCoverage(
  supabase: SupabaseClient,
  section: ListingBrandModelBackfillSection,
): Promise<ListingBrandModelSectionCoverage> {
  const base = activeListingCountQuery(supabase, section)
  const [allRes, eitherRes, brandRes, modelRes] = await Promise.all([
    base,
    base.or("brand_id.is.null,brand_model_id.is.null"),
    base.is("brand_id", null),
    base.is("brand_model_id", null),
  ])

  for (const res of [allRes, eitherRes, brandRes, modelRes]) {
    if (res.error) {
      console.error("getSectionListingBrandModelCoverage:", section, res.error.message)
    }
  }

  return {
    activeListings: allRes.count ?? 0,
    missingEither: eitherRes.count ?? 0,
    missingBrand: brandRes.count ?? 0,
    missingModel: modelRes.count ?? 0,
  }
}

export async function getListingBrandModelCoverage(
  supabase: SupabaseClient,
): Promise<ListingBrandModelCoverage> {
  const [surfboards, fins] = await Promise.all([
    getSectionListingBrandModelCoverage(supabase, "surfboards"),
    getSectionListingBrandModelCoverage(supabase, "fins"),
  ])
  return { surfboards, fins }
}

/** Directory brands limited to explicit ids (e.g. fin-tagged manufacturers). */
export async function loadDirectoryBrandsForMatchingByIds(
  supabase: SupabaseClient,
  brandIds: readonly string[],
): Promise<BrandMatchRow[]> {
  const uniqueIds = [...new Set(brandIds.filter(Boolean))]
  if (uniqueIds.length === 0) return []

  const out: BrandMatchRow[] = []

  for (let i = 0; i < uniqueIds.length; i += BRAND_ID_IN_CHUNK) {
    const chunk = uniqueIds.slice(i, i + BRAND_ID_IN_CHUNK)
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, slug")
      .in("id", chunk)
      .order("name", { ascending: true })

    if (error) {
      console.error("loadDirectoryBrandsForMatchingByIds:", error.message)
      break
    }

    for (const row of (data ?? []) as Array<{ id: string; name: string | null; slug: string | null }>) {
      if (!row.id || !row.name?.trim()) continue
      out.push({ id: row.id, name: row.name.trim(), slug: row.slug?.trim() ?? null })
    }
  }

  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/** Fin manufacturers from `brand_product_categories.category_slug = 'fins'`. */
export async function loadFinDirectoryBrandsForMatching(
  supabase: SupabaseClient,
): Promise<BrandMatchRow[]> {
  const finBrandIds = await listBrandIdsMatchingProductCategories(supabase, [
    FIN_CATALOG_PRODUCT_CATEGORY,
  ])
  if (!finBrandIds?.length) return []
  return loadDirectoryBrandsForMatchingByIds(supabase, finBrandIds)
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

/** `brand_models` grouped by `brand_id`, scoped to one product category. */
export async function loadBrandModelsByBrandIdForProductCategory(
  supabase: SupabaseClient,
  productCategorySlug: BrandProductCategorySlug,
): Promise<Map<string, ModelMatchRow[]>> {
  const byBrand = new Map<string, ModelMatchRow[]>()
  let from = 0

  for (;;) {
    const { data, error } = await supabase
      .from("brand_models")
      .select("id, brand_id, name")
      .eq("product_category_slug", productCategorySlug)
      .order("name", { ascending: true })
      .range(from, from + CATALOG_PAGE_SIZE - 1)

    if (error) {
      console.error("loadBrandModelsByBrandIdForProductCategory:", productCategorySlug, error.message)
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

/** One audit entry capturing a brand/model the backfill cron attached to a listing. */
export type ListingBrandModelAutofillInsert = {
  listing_id: string
  listing_title: string | null
  brand_id: string | null
  brand_name: string | null
  brand_model_id: string | null
  model_name: string | null
  attached_brand: boolean
  attached_model: boolean
}

/** Append an audit row so admins can cross-verify auto-attached brands/models. */
export async function recordListingBrandModelAutofill(
  supabase: SupabaseClient,
  entry: ListingBrandModelAutofillInsert,
): Promise<void> {
  const { error } = await supabase.from("listing_brand_model_autofills").insert(entry)
  if (error) {
    console.error("recordListingBrandModelAutofill:", error.message)
  }
}

/** Audit row joined to the listing's current state for the admin verification page. */
export type ListingBrandModelAutofillRow = {
  id: string
  listing_id: string
  listing_title: string | null
  brand_id: string | null
  brand_name: string | null
  brand_model_id: string | null
  model_name: string | null
  attached_brand: boolean
  attached_model: boolean
  created_at: string
  listing: {
    id: string
    slug: string | null
    section: string
    status: string
    title: string | null
    brand: string | null
    model: string | null
    brand_id: string | null
    brand_model_id: string | null
    listing_images: { url: string | null; is_primary: boolean | null }[]
  } | null
}

const AUTOFILL_ADMIN_SELECT = `
  id,
  listing_id,
  listing_title,
  brand_id,
  brand_name,
  brand_model_id,
  model_name,
  attached_brand,
  attached_model,
  created_at,
  listing:listing_id (
    id,
    slug,
    section,
    status,
    title,
    brand,
    model,
    brand_id,
    brand_model_id,
    listing_images ( url, is_primary )
  )
` as const

/** Most recent auto-attach audit rows for the admin verification page. */
export async function listListingBrandModelAutofills(
  supabase: SupabaseClient,
  options?: { limit?: number },
): Promise<ListingBrandModelAutofillRow[]> {
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 2000)

  const { data, error } = await supabase
    .from("listing_brand_model_autofills")
    .select(AUTOFILL_ADMIN_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("listListingBrandModelAutofills:", error.message)
    return []
  }

  return (data ?? []) as unknown as ListingBrandModelAutofillRow[]
}

/** Single audit row + the listing's current link state, for an undo action. */
export type ListingBrandModelAutofillUndoRow = {
  id: string
  listing_id: string
  brand_id: string | null
  brand_model_id: string | null
  attached_brand: boolean
  attached_model: boolean
  listing: {
    id: string
    brand_id: string | null
    brand_model_id: string | null
  } | null
}

export async function getListingBrandModelAutofillById(
  supabase: SupabaseClient,
  autofillId: string,
): Promise<ListingBrandModelAutofillUndoRow | null> {
  const { data, error } = await supabase
    .from("listing_brand_model_autofills")
    .select(
      "id, listing_id, brand_id, brand_model_id, attached_brand, attached_model, listing:listing_id ( id, brand_id, brand_model_id )",
    )
    .eq("id", autofillId)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error("getListingBrandModelAutofillById:", error.message)
    return null
  }
  return data as unknown as ListingBrandModelAutofillUndoRow
}

/**
 * Clear the cron-set brand on a listing — only when it still matches the value the
 * cron attached, so a later manual change is never clobbered.
 */
export async function clearListingBrandIfMatches(
  supabase: SupabaseClient,
  listingId: string,
  brandId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("listings")
    .update({ brand_id: null, brand: null, updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("brand_id", brandId)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("clearListingBrandIfMatches:", error.message)
    return false
  }
  return data != null
}

/** Clear the cron-set model on a listing — only when it still matches what was attached. */
export async function clearListingModelIfMatches(
  supabase: SupabaseClient,
  listingId: string,
  brandModelId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("listings")
    .update({ brand_model_id: null, model: null, updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("brand_model_id", brandModelId)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("clearListingModelIfMatches:", error.message)
    return false
  }
  return data != null
}

export async function deleteListingBrandModelAutofill(
  supabase: SupabaseClient,
  autofillId: string,
): Promise<void> {
  const { error } = await supabase
    .from("listing_brand_model_autofills")
    .delete()
    .eq("id", autofillId)
  if (error) {
    console.error("deleteListingBrandModelAutofill:", error.message)
  }
}

// ---------------------------------------------------------------------------
// Unmatched worklist: titles the cron could not resolve to a catalog brand/model.
// ---------------------------------------------------------------------------

export type ListingBrandModelUnmatchedUpsert = {
  listing_id: string
  listing_title: string | null
  needs_brand: boolean
  needs_model: boolean
  matched_brand_id: string | null
  matched_brand_name: string | null
}

/** Record (or refresh) a listing the cron could not fully match. */
export async function upsertListingBrandModelUnmatched(
  supabase: SupabaseClient,
  entry: ListingBrandModelUnmatchedUpsert,
): Promise<void> {
  const { error } = await supabase.from("listing_brand_model_unmatched").upsert(
    { ...entry, last_seen_at: new Date().toISOString() },
    { onConflict: "listing_id" },
  )
  if (error) {
    console.error("upsertListingBrandModelUnmatched:", error.message)
  }
}

/** Remove a listing from the unmatched worklist (a match was found). */
export async function clearListingBrandModelUnmatched(
  supabase: SupabaseClient,
  listingId: string,
): Promise<void> {
  const { error } = await supabase
    .from("listing_brand_model_unmatched")
    .delete()
    .eq("listing_id", listingId)
  if (error) {
    console.error("clearListingBrandModelUnmatched:", error.message)
  }
}

export type ListingBrandModelUnmatchedRow = {
  listing_id: string
  listing_title: string | null
  needs_brand: boolean
  needs_model: boolean
  matched_brand_id: string | null
  matched_brand_name: string | null
  first_seen_at: string
  last_seen_at: string
  listing: {
    id: string
    slug: string | null
    section: string
    status: string
    title: string | null
    brand: string | null
    model: string | null
    brand_id: string | null
    brand_model_id: string | null
    listing_images: { url: string | null; is_primary: boolean | null }[]
  } | null
}

const UNMATCHED_ADMIN_SELECT = `
  listing_id,
  listing_title,
  needs_brand,
  needs_model,
  matched_brand_id,
  matched_brand_name,
  first_seen_at,
  last_seen_at,
  listing:listing_id (
    id,
    slug,
    section,
    status,
    title,
    brand,
    model,
    brand_id,
    brand_model_id,
    listing_images ( url, is_primary )
  )
` as const

export async function listListingBrandModelUnmatched(
  supabase: SupabaseClient,
  options?: { limit?: number },
): Promise<ListingBrandModelUnmatchedRow[]> {
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 2000)

  const { data, error } = await supabase
    .from("listing_brand_model_unmatched")
    .select(UNMATCHED_ADMIN_SELECT)
    .order("last_seen_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("listListingBrandModelUnmatched:", error.message)
    return []
  }

  return (data ?? []) as unknown as ListingBrandModelUnmatchedRow[]
}
