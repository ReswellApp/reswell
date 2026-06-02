import type { SupabaseClient } from "@supabase/supabase-js"
import { listingHeroSlideSrc, type ListingImageForCard } from "@/lib/listing-image-display"

const CURATION_TABLE = "boards_browse_top_picks_listings"

const CURATION_LISTING_SELECT = `
  id,
  slug,
  title,
  status,
  hidden_from_site,
  listing_images (url, thumbnail_url, is_primary)
`

type JoinedListing = {
  id: string
  slug: string
  title: string
  status: string | null
  hidden_from_site: boolean | null
  listing_images: ListingImageForCard[] | null
}

type RawCurationRow = {
  id: string
  listing_id: string
  sort_order: number
  listings: JoinedListing | JoinedListing[] | null
}

export type BoardsBrowseTopPickCurationRow = {
  id: string
  listing_id: string
  sort_order: number
  listing: {
    id: string
    slug: string
    title: string
    status: string | null
    hidden_from_site: boolean | null
    primary_image_url: string | null
  }
}

function hydrateRow(row: RawCurationRow): BoardsBrowseTopPickCurationRow | null {
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
      primary_image_url: listingHeroSlideSrc(listing.listing_images),
    },
  }
}

export async function listBoardsBrowseTopPickCurationRows(
  supabase: SupabaseClient,
): Promise<BoardsBrowseTopPickCurationRow[]> {
  const { data, error } = await supabase
    .from(CURATION_TABLE)
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
    console.error("listBoardsBrowseTopPickCurationRows:", error.message)
    return []
  }

  return (data ?? [])
    .map((row) => hydrateRow(row as unknown as RawCurationRow))
    .filter((r): r is BoardsBrowseTopPickCurationRow => r !== null)
}

/** Listing UUIDs in curation order (may include stale rows — caller filters eligibility). */
export async function listBoardsBrowseTopPickListingIdsOrdered(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await supabase
    .from(CURATION_TABLE)
    .select("listing_id")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    console.error("listBoardsBrowseTopPickListingIdsOrdered:", error.message)
    return []
  }
  return (data ?? []).map((r) => String((r as { listing_id: string }).listing_id))
}

async function readMaxSortOrder(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from(CURATION_TABLE)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("readMaxSortOrder (boards top picks):", error.message)
    return -1
  }
  return typeof data?.sort_order === "number" ? data.sort_order : -1
}

export type InsertBoardsBrowseTopPickResult =
  | { ok: true; id: string }
  | { ok: false; error: string; alreadyExists?: boolean }

export async function insertBoardsBrowseTopPickListing(
  supabase: SupabaseClient,
  listingId: string,
): Promise<InsertBoardsBrowseTopPickResult> {
  const existing = await supabase
    .from(CURATION_TABLE)
    .select("id")
    .eq("listing_id", listingId)
    .maybeSingle()

  if (existing.error) {
    console.error("insertBoardsBrowseTopPickListing lookup:", existing.error.message)
    return { ok: false, error: existing.error.message || "Lookup failed" }
  }
  if (existing.data?.id) {
    return { ok: false, error: "Listing is already a Top Pick", alreadyExists: true }
  }

  const maxOrder = await readMaxSortOrder(supabase)
  const { data, error } = await supabase
    .from(CURATION_TABLE)
    .insert({ listing_id: listingId, sort_order: maxOrder + 1 })
    .select("id")
    .single()

  if (error) {
    console.error("insertBoardsBrowseTopPickListing insert:", error.message)
    return { ok: false, error: error.message || "Insert failed" }
  }
  if (!data?.id) return { ok: false, error: "No row returned" }
  return { ok: true, id: String(data.id) }
}

export async function deleteBoardsBrowseTopPickListingRow(
  supabase: SupabaseClient,
  rowId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.from(CURATION_TABLE).delete().eq("id", rowId).select("id")

  if (error) {
    console.error("deleteBoardsBrowseTopPickListingRow:", error.message)
    return { ok: false, error: error.message || "Delete failed" }
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: "No row deleted (check id)" }
  }
  return { ok: true }
}

export async function reorderBoardsBrowseTopPickListingRows(
  supabase: SupabaseClient,
  orderedRowIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let i = 0; i < orderedRowIds.length; i++) {
    const { error } = await supabase
      .from(CURATION_TABLE)
      .update({ sort_order: i })
      .eq("id", orderedRowIds[i])
    if (error) {
      console.error("reorderBoardsBrowseTopPickListingRows:", error.message)
      return { ok: false, error: error.message || "Reorder failed" }
    }
  }
  return { ok: true }
}

export type BoardsBrowseTopPickSearchHit = {
  id: string
  slug: string
  title: string
  primary_image_url: string | null
  status: string | null
  hidden_from_site: boolean | null
  already_curated: boolean
}

export async function searchListingsForBoardsBrowseTopPickPicker(
  supabase: SupabaseClient,
  query: string,
  limit = 20,
): Promise<BoardsBrowseTopPickSearchHit[]> {
  const q = query.trim()
  let builder = supabase
    .from("listings")
    .select(
      `id, slug, title, status, hidden_from_site,
       listing_images (url, thumbnail_url, is_primary)`,
    )
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .eq("section", "surfboards")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50))

  if (q) {
    const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`
    builder = builder.ilike("title", like)
  }

  const { data, error } = await builder
  if (error) {
    console.error("searchListingsForBoardsBrowseTopPickPicker:", error.message)
    return []
  }

  const rows = (data ?? []) as Array<{
    id: string
    slug: string
    title: string
    status: string | null
    hidden_from_site: boolean | null
    listing_images: ListingImageForCard[] | null
  }>

  const ids = rows.map((r) => r.id)
  let curatedIds = new Set<string>()
  if (ids.length > 0) {
    const { data: curated, error: curErr } = await supabase
      .from(CURATION_TABLE)
      .select("listing_id")
      .in("listing_id", ids)
    if (curErr) {
      console.error("searchListingsForBoardsBrowseTopPickPicker curated:", curErr.message)
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
    primary_image_url: listingHeroSlideSrc(r.listing_images),
    already_curated: curatedIds.has(r.id),
  }))
}
