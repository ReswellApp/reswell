import type { SupabaseClient } from "@supabase/supabase-js"
import { listingHeroSlideSrc, type ListingImageForCard } from "@/lib/listing-image-display"

export type HomeRecentSectionKey = "recent_surfboards" | "recent_shortboards"

function curationTableName(key: HomeRecentSectionKey): string {
  return key === "recent_surfboards"
    ? "home_recent_surfboards_listings"
    : "home_recent_shortboards_listings"
}

type JoinedListing = {
  id: string
  slug: string
  title: string
  status: string | null
  hidden_from_site: boolean | null
  hidden_from_homepage: boolean | null
  listing_images: ListingImageForCard[] | null
}

type RawCurationRow = {
  id: string
  listing_id: string
  sort_order: number
  listings: JoinedListing | JoinedListing[] | null
}

const CURATION_LISTING_SELECT = `
  id,
  slug,
  title,
  status,
  hidden_from_site,
  hidden_from_homepage,
  listing_images (url, thumbnail_url, is_primary)
`

function hydrateRow(row: RawCurationRow): HomeRecentSectionCurationRow | null {
  const joined = row.listings
  const listing = Array.isArray(joined) ? joined[0] ?? null : joined
  if (!listing) return null
  return {
    id: row.id,
    listing_id: row.listing_id,
    sort_order: row.sort_order,
    listing: {
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      status: listing.status,
      hidden_from_site: listing.hidden_from_site,
      hidden_from_homepage: listing.hidden_from_homepage,
      primary_image_url: listingHeroSlideSrc(listing.listing_images),
    },
  }
}

/** Admin dialog + API: curated rows with minimal listing meta. */
export type HomeRecentSectionCurationRow = {
  id: string
  listing_id: string
  sort_order: number
  listing: {
    id: string
    slug: string
    title: string
    status: string | null
    hidden_from_site: boolean | null
    hidden_from_homepage: boolean | null
    primary_image_url: string | null
  }
}

export async function listHomeRecentSectionCurationRows(
  supabase: SupabaseClient,
  key: HomeRecentSectionKey,
): Promise<HomeRecentSectionCurationRow[]> {
  const table = curationTableName(key)
  const { data, error } = await supabase
    .from(table)
    .select(
      `
      id,
      listing_id,
      sort_order,
      listings:listing_id (${CURATION_LISTING_SELECT})
    `,
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    console.error(`listHomeRecentSectionCurationRows (${key}):`, error.message)
    return []
  }

  return (data ?? [])
    .map((row) => hydrateRow(row as unknown as RawCurationRow))
    .filter((r): r is HomeRecentSectionCurationRow => r !== null)
}

/** Listing UUIDs in curation order (may include stale rows — caller filters eligibility). */
export async function listHomeRecentSectionListingIdsOrdered(
  supabase: SupabaseClient,
  key: HomeRecentSectionKey,
): Promise<string[]> {
  const table = curationTableName(key)
  const { data, error } = await supabase
    .from(table)
    .select("listing_id")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    console.error(`listHomeRecentSectionListingIdsOrdered (${key}):`, error.message)
    return []
  }
  return (data ?? []).map((r) => String((r as { listing_id: string }).listing_id))
}

async function readMaxSortOrder(supabase: SupabaseClient, key: HomeRecentSectionKey): Promise<number> {
  const table = curationTableName(key)
  const { data, error } = await supabase
    .from(table)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(`readMaxSortOrder (${key}):`, error.message)
    return -1
  }
  return typeof data?.sort_order === "number" ? data.sort_order : -1
}

export type InsertHomeRecentSectionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; alreadyExists?: boolean }

export async function insertHomeRecentSectionListing(
  supabase: SupabaseClient,
  key: HomeRecentSectionKey,
  listingId: string,
): Promise<InsertHomeRecentSectionResult> {
  const table = curationTableName(key)
  const existing = await supabase.from(table).select("id").eq("listing_id", listingId).maybeSingle()

  if (existing.error) {
    console.error(`insertHomeRecentSectionListing (${key}) lookup:`, existing.error.message)
    return { ok: false, error: existing.error.message || "Lookup failed" }
  }
  if (existing.data?.id) {
    return { ok: false, error: "Listing is already in this row", alreadyExists: true }
  }

  const maxOrder = await readMaxSortOrder(supabase, key)
  const { data, error } = await supabase
    .from(table)
    .insert({ listing_id: listingId, sort_order: maxOrder + 1 })
    .select("id")
    .single()

  if (error) {
    console.error(`insertHomeRecentSectionListing (${key}) insert:`, error.message)
    return { ok: false, error: error.message || "Insert failed" }
  }
  if (!data?.id) return { ok: false, error: "No row returned" }
  return { ok: true, id: String(data.id) }
}

export async function deleteHomeRecentSectionListingRow(
  supabase: SupabaseClient,
  key: HomeRecentSectionKey,
  rowId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const table = curationTableName(key)
  const { data, error } = await supabase.from(table).delete().eq("id", rowId).select("id")

  if (error) {
    console.error(`deleteHomeRecentSectionListingRow (${key}):`, error.message)
    return { ok: false, error: error.message || "Delete failed" }
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: "No row deleted (check id)" }
  }
  return { ok: true }
}

export async function reorderHomeRecentSectionListingRows(
  supabase: SupabaseClient,
  key: HomeRecentSectionKey,
  orderedRowIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const table = curationTableName(key)
  for (let i = 0; i < orderedRowIds.length; i++) {
    const { error } = await supabase.from(table).update({ sort_order: i }).eq("id", orderedRowIds[i])
    if (error) {
      console.error(`reorderHomeRecentSectionListingRows (${key}):`, error.message)
      return { ok: false, error: error.message || "Reorder failed" }
    }
  }
  return { ok: true }
}

export type HomeRecentSectionSearchHit = {
  id: string
  slug: string
  title: string
  primary_image_url: string | null
  status: string | null
  hidden_from_site: boolean | null
  hidden_from_homepage: boolean | null
  already_curated: boolean
}

export async function searchListingsForHomeRecentSectionPicker(
  supabase: SupabaseClient,
  key: HomeRecentSectionKey,
  query: string,
  limit = 20,
): Promise<HomeRecentSectionSearchHit[]> {
  const q = query.trim()
  let builder = supabase
    .from("listings")
    .select(
      `id, slug, title, status, hidden_from_site, hidden_from_homepage,
       listing_images (url, thumbnail_url, is_primary),
       categories (name)`,
    )
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .eq("section", "surfboards")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50))

  if (key === "recent_shortboards") {
    builder = builder.eq("board_type", "shortboard")
  }

  if (q) {
    const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`
    builder = builder.ilike("title", like)
  }

  const { data, error } = await builder
  if (error) {
    console.error(`searchListingsForHomeRecentSectionPicker (${key}):`, error.message)
    return []
  }

  const rows = (data ?? []) as Array<{
    id: string
    slug: string
    title: string
    status: string | null
    hidden_from_site: boolean | null
    hidden_from_homepage: boolean | null
    listing_images: ListingImageForCard[] | null
  }>

  const ids = rows.map((r) => r.id)
  let curatedIds = new Set<string>()
  if (ids.length > 0) {
    const table = curationTableName(key)
    const { data: curated, error: curErr } = await supabase.from(table).select("listing_id").in("listing_id", ids)
    if (curErr) {
      console.error(`searchListingsForHomeRecentSectionPicker curated (${key}):`, curErr.message)
    } else if (Array.isArray(curated)) {
      curatedIds = new Set(curated.map((r) => String((r as { listing_id: string }).listing_id)))
    }
  }

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    hidden_from_site: r.hidden_from_site,
    hidden_from_homepage: r.hidden_from_homepage,
    primary_image_url: listingHeroSlideSrc(r.listing_images),
    already_curated: curatedIds.has(r.id),
  }))
}
