import type { SupabaseClient } from "@supabase/supabase-js"
import { listingHeroSlideSrc, type ListingImageForCard } from "@/lib/listing-image-display"

/**
 * Hero-listing rows as stored in `public.home_hero_listings`, hydrated with the joined
 * listing's public data the admin UI / homepage need.
 */
export interface HomeHeroListingRow {
  id: string
  listing_id: string
  sort_order: number
  listing: {
    id: string
    slug: string
    title: string
    status: string | null
    section: string | null
    hidden_from_site: boolean | null
    hidden_from_homepage: boolean | null
    primary_image_url: string | null
  }
}

type JoinedListing = {
  id: string
  slug: string
  title: string
  status: string | null
  section: string | null
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

const CURATION_SELECT = `
  id,
  listing_id,
  sort_order,
  listings:listing_id (
    id,
    slug,
    title,
    status,
    section,
    hidden_from_site,
    hidden_from_homepage,
    listing_images (url, thumbnail_url, is_primary)
  )
`

function pickListing(joined: JoinedListing | JoinedListing[] | null): JoinedListing | null {
  if (!joined) return null
  return Array.isArray(joined) ? joined[0] ?? null : joined
}

function hydrate(row: RawCurationRow): HomeHeroListingRow | null {
  const listing = pickListing(row.listings)
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
      section: listing.section,
      hidden_from_site: listing.hidden_from_site,
      hidden_from_homepage: listing.hidden_from_homepage,
      primary_image_url: listingHeroSlideSrc(listing.listing_images),
    },
  }
}

/** All curated rows in explicit sort order, with joined listing metadata. Missing/deleted listings are filtered out. */
export async function listHomeHeroListingRows(
  supabase: SupabaseClient,
): Promise<HomeHeroListingRow[]> {
  const { data, error } = await supabase
    .from("home_hero_listings")
    .select(CURATION_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    console.error("listHomeHeroListingRows:", error.message)
    return []
  }

  return (data ?? [])
    .map((row) => hydrate(row as unknown as RawCurationRow))
    .filter((r): r is HomeHeroListingRow => r !== null)
}

export type ListHomeHeroCuratedSlideUrlsOptions = {
  /** When set, only curated listings in this marketplace section are included. */
  section?: string
}

/**
 * Public-safe hero slide URLs derived from curated listings. Filters out listings that are
 * no longer active or hidden from the site, and listings with no primary image.
 */
export async function listHomeHeroCuratedSlideUrls(
  supabase: SupabaseClient,
  options?: ListHomeHeroCuratedSlideUrlsOptions,
): Promise<string[]> {
  const sectionFilter = options?.section?.trim()
  const rows = await listHomeHeroListingRows(supabase)
  const out: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const listing = row.listing
    if (sectionFilter && listing.section !== sectionFilter) continue
    if (listing.status && listing.status !== "active") continue
    if (listing.hidden_from_site === true) continue
    if (listing.hidden_from_homepage === true) continue
    const url = listing.primary_image_url?.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

async function readMaxSortOrder(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from("home_hero_listings")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error("readMaxSortOrder (home_hero_listings):", error.message)
    return -1
  }
  return typeof data?.sort_order === "number" ? data.sort_order : -1
}

export type InsertHomeHeroListingResult =
  | { ok: true; id: string }
  | { ok: false; error: string; alreadyExists?: boolean }

/** Appends a curated listing to the end of the hero carousel. Idempotent per `listing_id`. */
export async function insertHomeHeroListing(
  supabase: SupabaseClient,
  listingId: string,
): Promise<InsertHomeHeroListingResult> {
  const existing = await supabase
    .from("home_hero_listings")
    .select("id")
    .eq("listing_id", listingId)
    .maybeSingle()

  if (existing.error) {
    console.error("insertHomeHeroListing (lookup):", existing.error.message)
    return { ok: false, error: existing.error.message || "Lookup failed" }
  }
  if (existing.data?.id) {
    return { ok: false, error: "Listing is already in the hero slideshow", alreadyExists: true }
  }

  const maxOrder = await readMaxSortOrder(supabase)
  const { data, error } = await supabase
    .from("home_hero_listings")
    .insert({ listing_id: listingId, sort_order: maxOrder + 1 })
    .select("id")
    .single()

  if (error) {
    console.error("insertHomeHeroListing (insert):", error.message)
    return { ok: false, error: error.message || "Insert failed" }
  }
  if (!data?.id) {
    return { ok: false, error: "No row returned" }
  }
  return { ok: true, id: String(data.id) }
}

export async function deleteHomeHeroListingRow(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("home_hero_listings")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    console.error("deleteHomeHeroListingRow:", error.message)
    return { ok: false, error: error.message || "Delete failed" }
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: "No row deleted (check id)" }
  }
  return { ok: true }
}

export type HomeHeroListingSearchHit = {
  id: string
  slug: string
  title: string
  primary_image_url: string | null
  status: string | null
  hidden_from_site: boolean | null
  already_curated: boolean
}

/**
 * Admin listing picker. Title-ilike search over active surfboard listings, annotated with
 * whether each row is already in the hero carousel so the UI can disable/adjust the Add action.
 */
export async function searchListingsForHeroPicker(
  supabase: SupabaseClient,
  query: string,
  limit = 20,
): Promise<HomeHeroListingSearchHit[]> {
  const q = query.trim()

  let builder = supabase
    .from("listings")
    .select(
      `id, slug, title, status, hidden_from_site, hidden_from_homepage,
       listing_images (url, thumbnail_url, is_primary)`,
    )
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .eq("hidden_from_homepage", false)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50))

  if (q) {
    const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`
    builder = builder.ilike("title", like)
  }

  const { data, error } = await builder
  if (error) {
    console.error("searchListingsForHeroPicker:", error.message)
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
    const { data: curated, error: curErr } = await supabase
      .from("home_hero_listings")
      .select("listing_id")
      .in("listing_id", ids)
    if (curErr) {
      console.error("searchListingsForHeroPicker (curated lookup):", curErr.message)
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
