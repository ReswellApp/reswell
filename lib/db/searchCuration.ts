import type { SupabaseClient } from "@supabase/supabase-js"
import { listingHeroSlideSrc, type ListingImageForCard } from "@/lib/listing-image-display"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SearchSynonymRow = {
  id: string
  term: string
  expansions: string[]
  enabled: boolean
  created_at: string
  updated_at: string
}

export type SearchOverrideListing = {
  rowId: string
  listingId: string
  sortOrder: number
  title: string
  slug: string | null
  status: string | null
  hiddenFromSite: boolean | null
  primaryImageUrl: string | null
}

export type SearchOverrideRow = {
  id: string
  queryNormalized: string
  queryDisplay: string | null
  note: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
  listings: SearchOverrideListing[]
}

// ---------------------------------------------------------------------------
// Synonyms
// ---------------------------------------------------------------------------

export async function listSearchSynonyms(
  supabase: SupabaseClient,
): Promise<{ data: SearchSynonymRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("search_synonyms")
    .select("id, term, expansions, enabled, created_at, updated_at")
    .order("updated_at", { ascending: false })

  if (error) return { data: [], error: new Error(error.message) }
  return { data: (data ?? []) as SearchSynonymRow[], error: null }
}

/** Runtime read (service role, cached upstream): only enabled rows. */
export async function listEnabledSearchSynonyms(
  service: SupabaseClient,
): Promise<SearchSynonymRow[]> {
  const { data, error } = await service
    .from("search_synonyms")
    .select("id, term, expansions, enabled, created_at, updated_at")
    .eq("enabled", true)

  if (error) {
    console.error("listEnabledSearchSynonyms:", error.message)
    return []
  }
  return (data ?? []) as SearchSynonymRow[]
}

export async function insertSearchSynonym(
  supabase: SupabaseClient,
  userId: string,
  input: { term: string; expansions: string[]; enabled: boolean },
): Promise<{ data: SearchSynonymRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("search_synonyms")
    .insert({
      term: input.term.trim(),
      expansions: input.expansions.map((e) => e.trim()).filter(Boolean),
      enabled: input.enabled,
      created_by: userId,
      updated_at: new Date().toISOString(),
    })
    .select("id, term, expansions, enabled, created_at, updated_at")
    .maybeSingle()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: data as SearchSynonymRow | null, error: null }
}

export async function updateSearchSynonym(
  supabase: SupabaseClient,
  id: string,
  patch: { term?: string; expansions?: string[]; enabled?: boolean },
): Promise<{ data: SearchSynonymRow | null; error: Error | null }> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.term !== undefined) update.term = patch.term.trim()
  if (patch.expansions !== undefined) {
    update.expansions = patch.expansions.map((e) => e.trim()).filter(Boolean)
  }
  if (patch.enabled !== undefined) update.enabled = patch.enabled

  const { data, error } = await supabase
    .from("search_synonyms")
    .update(update)
    .eq("id", id)
    .select("id, term, expansions, enabled, created_at, updated_at")
    .maybeSingle()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: data as SearchSynonymRow | null, error: null }
}

export async function deleteSearchSynonym(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("search_synonyms").delete().eq("id", id)
  if (error) return { error: new Error(error.message) }
  return { error: null }
}

// ---------------------------------------------------------------------------
// Overrides
// ---------------------------------------------------------------------------

type RawOverrideListing = {
  id: string
  listing_id: string
  sort_order: number
  listings:
    | {
        id: string
        slug: string | null
        title: string
        status: string | null
        hidden_from_site: boolean | null
        listing_images: ListingImageForCard[] | null
      }
    | Array<{
        id: string
        slug: string | null
        title: string
        status: string | null
        hidden_from_site: boolean | null
        listing_images: ListingImageForCard[] | null
      }>
    | null
}

function hydrateOverrideListing(raw: RawOverrideListing): SearchOverrideListing | null {
  const joined = Array.isArray(raw.listings) ? raw.listings[0] ?? null : raw.listings
  if (!joined) return null
  return {
    rowId: raw.id,
    listingId: raw.listing_id,
    sortOrder: raw.sort_order,
    title: joined.title,
    slug: joined.slug,
    status: joined.status,
    hiddenFromSite: joined.hidden_from_site,
    primaryImageUrl: listingHeroSlideSrc(joined.listing_images),
  }
}

const OVERRIDE_LISTING_SELECT = `
  id,
  listing_id,
  sort_order,
  listings:listing_id (id, slug, title, status, hidden_from_site, listing_images (url, thumbnail_url, is_primary))
`

export async function listSearchOverridesWithListings(
  supabase: SupabaseClient,
): Promise<{ data: SearchOverrideRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("search_result_overrides")
    .select(
      `id, query_normalized, query_display, note, enabled, created_at, updated_at,
       search_result_override_listings (${OVERRIDE_LISTING_SELECT})`,
    )
    .order("updated_at", { ascending: false })

  if (error) return { data: [], error: new Error(error.message) }

  const rows = (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      query_normalized: string
      query_display: string | null
      note: string | null
      enabled: boolean
      created_at: string
      updated_at: string
      search_result_override_listings: RawOverrideListing[] | null
    }
    const listings = (r.search_result_override_listings ?? [])
      .map(hydrateOverrideListing)
      .filter((l): l is SearchOverrideListing => l !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return {
      id: r.id,
      queryNormalized: r.query_normalized,
      queryDisplay: r.query_display,
      note: r.note,
      enabled: r.enabled,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      listings,
    }
  })

  return { data: rows, error: null }
}

export async function upsertSearchOverride(
  supabase: SupabaseClient,
  userId: string,
  input: { queryNormalized: string; queryDisplay: string; note?: string; enabled: boolean },
): Promise<{ data: { id: string } | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("search_result_overrides")
    .upsert(
      {
        query_normalized: input.queryNormalized,
        query_display: input.queryDisplay,
        note: input.note?.trim() || null,
        enabled: input.enabled,
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "query_normalized" },
    )
    .select("id")
    .maybeSingle()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: data as { id: string } | null, error: null }
}

export async function updateSearchOverride(
  supabase: SupabaseClient,
  id: string,
  patch: { note?: string | null; enabled?: boolean },
): Promise<{ error: Error | null }> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.note !== undefined) update.note = patch.note?.trim() || null
  if (patch.enabled !== undefined) update.enabled = patch.enabled

  const { error } = await supabase.from("search_result_overrides").update(update).eq("id", id)
  if (error) return { error: new Error(error.message) }
  return { error: null }
}

export async function deleteSearchOverride(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("search_result_overrides").delete().eq("id", id)
  if (error) return { error: new Error(error.message) }
  return { error: null }
}

async function readMaxOverrideListingSortOrder(
  supabase: SupabaseClient,
  overrideId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("search_result_override_listings")
    .select("sort_order")
    .eq("override_id", overrideId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("readMaxOverrideListingSortOrder:", error.message)
    return -1
  }
  return typeof data?.sort_order === "number" ? data.sort_order : -1
}

export async function addSearchOverrideListing(
  supabase: SupabaseClient,
  overrideId: string,
  listingId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string; alreadyExists?: boolean }> {
  const existing = await supabase
    .from("search_result_override_listings")
    .select("id")
    .eq("override_id", overrideId)
    .eq("listing_id", listingId)
    .maybeSingle()

  if (existing.error) return { ok: false, error: existing.error.message }
  if (existing.data?.id) return { ok: false, error: "Listing already pinned", alreadyExists: true }

  const maxOrder = await readMaxOverrideListingSortOrder(supabase, overrideId)
  const { data, error } = await supabase
    .from("search_result_override_listings")
    .insert({ override_id: overrideId, listing_id: listingId, sort_order: maxOrder + 1 })
    .select("id")
    .single()

  if (error) return { ok: false, error: error.message }
  if (!data?.id) return { ok: false, error: "No row returned" }
  return { ok: true, id: String(data.id) }
}

export async function deleteSearchOverrideListing(
  supabase: SupabaseClient,
  rowId: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("search_result_override_listings")
    .delete()
    .eq("id", rowId)
  if (error) return { error: new Error(error.message) }
  return { error: null }
}

export async function reorderSearchOverrideListings(
  supabase: SupabaseClient,
  overrideId: string,
  orderedRowIds: string[],
): Promise<{ error: Error | null }> {
  for (let i = 0; i < orderedRowIds.length; i++) {
    const { error } = await supabase
      .from("search_result_override_listings")
      .update({ sort_order: i })
      .eq("id", orderedRowIds[i])
      .eq("override_id", overrideId)
    if (error) return { error: new Error(error.message) }
  }
  return { error: null }
}

/** Runtime read (service role, cached upstream): ordered pinned listing ids for an enabled override. */
export async function listEnabledOverrideListingIdsForQuery(
  service: SupabaseClient,
  queryNormalized: string,
): Promise<string[]> {
  const { data: override, error } = await service
    .from("search_result_overrides")
    .select("id, enabled")
    .eq("query_normalized", queryNormalized)
    .maybeSingle()

  if (error || !override?.id || override.enabled !== true) return []

  const { data: rows, error: rowsError } = await service
    .from("search_result_override_listings")
    .select("listing_id, sort_order")
    .eq("override_id", override.id)
    .order("sort_order", { ascending: true })

  if (rowsError) {
    console.error("listEnabledOverrideListingIdsForQuery:", rowsError.message)
    return []
  }
  return (rows ?? []).map((r) => String((r as { listing_id: string }).listing_id))
}
