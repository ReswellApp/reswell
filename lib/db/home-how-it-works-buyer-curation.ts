import type { SupabaseClient } from "@supabase/supabase-js"
import { listingCardImageSrc, type ListingImageForCard } from "@/lib/listing-image-display"
export type HowItWorksBuyerCurationSlot = "shortboard" | "hybrid" | "longboard"

type JoinedListing = {
  id: string
  slug: string
  title: string
  status: string | null
  hidden_from_site: boolean | null
  hidden_from_homepage: boolean | null
  board_type: string | null
  listing_images: ListingImageForCard[] | null
}

export type HowItWorksBuyerCurationRow = {
  board_type: HowItWorksBuyerCurationSlot
  listing_id: string
  listing: {
    id: string
    slug: string
    title: string
    status: string | null
    hidden_from_site: boolean | null
    hidden_from_homepage: boolean | null
    board_type: string | null
    card_image_url: string | null
  }
}

const LISTING_FIELDS = `
  id,
  slug,
  title,
  status,
  hidden_from_site,
  hidden_from_homepage,
  board_type,
  listing_images (url, thumbnail_url, sort_order, is_primary)
`

function pickListing(joined: JoinedListing | JoinedListing[] | null): JoinedListing | null {
  if (!joined) return null
  return Array.isArray(joined) ? joined[0] ?? null : joined
}

function hydrate(
  boardType: HowItWorksBuyerCurationSlot,
  listingId: string,
  joined: JoinedListing | JoinedListing[] | null,
): HowItWorksBuyerCurationRow {
  const listing = pickListing(joined)
  const images = listing?.listing_images ?? null
  return {
    board_type: boardType,
    listing_id: listingId,
    listing: {
      id: listing?.id ?? listingId,
      slug: listing?.slug ?? "",
      title: listing?.title ?? "",
      status: listing?.status ?? null,
      hidden_from_site: listing?.hidden_from_site ?? null,
      hidden_from_homepage: listing?.hidden_from_homepage ?? null,
      board_type: listing?.board_type ?? null,
      card_image_url: listing ? listingCardImageSrc(images) : null,
    },
  }
}

export async function listHowItWorksBuyerCurationRowsForAdmin(
  supabase: SupabaseClient,
): Promise<HowItWorksBuyerCurationRow[]> {
  const slots: HowItWorksBuyerCurationSlot[] = ["shortboard", "hybrid", "longboard"]
  const { data, error } = await supabase
    .from("home_how_it_works_buyer_listings")
    .select(`board_type, listing_id, listings:listing_id (${LISTING_FIELDS})`)
    .in("board_type", slots)

  if (error) {
    console.error("listHowItWorksBuyerCurationRowsForAdmin:", error.message)
    return []
  }

  const byType = new Map<string, { listing_id: string; listings: unknown }>()
  for (const row of data ?? []) {
    const r = row as { board_type: string; listing_id: string; listings: unknown }
    byType.set(r.board_type, { listing_id: r.listing_id, listings: r.listings })
  }

  return slots.map((boardType) => {
    const found = byType.get(boardType)
    if (!found) {
      return hydrate(boardType, "", null)
    }
    return hydrate(
      boardType,
      found.listing_id,
      found.listings as JoinedListing | JoinedListing[] | null,
    )
  })
}

export async function getHowItWorksBuyerCuratedListingId(
  supabase: SupabaseClient,
  boardType: HowItWorksBuyerCurationSlot,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("home_how_it_works_buyer_listings")
    .select("listing_id")
    .eq("board_type", boardType)
    .maybeSingle()

  if (error) {
    console.error(`getHowItWorksBuyerCuratedListingId (${boardType}):`, error.message)
    return null
  }
  const id = data && typeof (data as { listing_id?: string }).listing_id === "string" ? (data as { listing_id: string }).listing_id : ""
  return id || null
}

export async function upsertHowItWorksBuyerListingSlot(
  supabase: SupabaseClient,
  boardType: HowItWorksBuyerCurationSlot,
  listingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("home_how_it_works_buyer_listings").upsert(
    {
      board_type: boardType,
      listing_id: listingId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "board_type" },
  )

  if (error) {
    console.error("upsertHowItWorksBuyerListingSlot:", error.message)
    return { ok: false, error: error.message || "Upsert failed" }
  }
  return { ok: true }
}

export async function deleteHowItWorksBuyerListingSlot(
  supabase: SupabaseClient,
  boardType: HowItWorksBuyerCurationSlot,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("home_how_it_works_buyer_listings")
    .delete()
    .eq("board_type", boardType)
    .select("board_type")

  if (error) {
    console.error("deleteHowItWorksBuyerListingSlot:", error.message)
    return { ok: false, error: error.message || "Delete failed" }
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: "No row deleted" }
  }
  return { ok: true }
}

export type HowItWorksBuyerSearchHit = {
  id: string
  slug: string
  title: string
  primary_image_url: string | null
  board_type: string | null
  hidden_from_homepage: boolean | null
  already_assigned_here: boolean
  assigned_board_type_other: HowItWorksBuyerCurationSlot | null
}

export async function searchListingsForHowItWorksBuyerPicker(
  supabase: SupabaseClient,
  slot: HowItWorksBuyerCurationSlot,
  query: string,
  limit = 20,
): Promise<HowItWorksBuyerSearchHit[]> {
  const q = query.trim()

  let builder = supabase
    .from("listings")
    .select(
      `id, slug, title, board_type, hidden_from_homepage,
       listing_images (url, thumbnail_url, sort_order, is_primary)`,
    )
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .eq("section", "surfboards")
    .eq("board_type", slot)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50))

  if (q) {
    const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`
    builder = builder.ilike("title", like)
  }

  const { data, error } = await builder
  if (error) {
    console.error("searchListingsForHowItWorksBuyerPicker:", error.message)
    return []
  }

  const rows = (data ?? []) as Array<{
    id: string
    slug: string
    title: string
    board_type: string | null
    hidden_from_homepage: boolean | null
    listing_images: ListingImageForCard[] | null
  }>

  const { data: slotRows } = await supabase
    .from("home_how_it_works_buyer_listings")
    .select("board_type, listing_id")

  const assignment = new Map<string, HowItWorksBuyerCurationSlot>()
  for (const r of slotRows ?? []) {
    const row = r as { board_type: HowItWorksBuyerCurationSlot; listing_id: string }
    assignment.set(row.listing_id, row.board_type)
  }

  return rows.map((r) => {
    const at = assignment.get(r.id)
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      board_type: r.board_type,
      hidden_from_homepage: r.hidden_from_homepage,
      primary_image_url: listingCardImageSrc(r.listing_images),
      already_assigned_here: at === slot,
      assigned_board_type_other: at && at !== slot ? at : null,
    }
  })
}
