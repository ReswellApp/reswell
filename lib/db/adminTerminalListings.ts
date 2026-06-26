import type { SupabaseClient } from "@supabase/supabase-js"
import { listingHeroSlideSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type AdminTerminalListingSearchHit = {
  id: string
  slug: string | null
  title: string
  status: string
  price: number
  hiddenFromSite: boolean
  coverUrl: string | null
  pickupAvailable: boolean
  shippingAvailable: boolean
}

type SearchRow = {
  id: string
  slug: string | null
  title: string | null
  status: string
  price: string | number
  hidden_from_site: boolean | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  listing_images: ListingImageForCard[] | null
}

const TERMINAL_LISTING_SELECT = `
  id,
  slug,
  title,
  status,
  price,
  hidden_from_site,
  local_pickup,
  shipping_available,
  listing_images (url, thumbnail_url, is_primary)
`.trim()

function escapeIlikePattern(raw: string): string {
  return raw.replace(/[%_\\]/g, (m) => `\\${m}`)
}

function toSearchHit(row: SearchRow): AdminTerminalListingSearchHit {
  const itemPrice = Math.round(parseFloat(String(row.price)) * 100) / 100
  return {
    id: row.id,
    slug: row.slug,
    title: row.title?.trim() || "Untitled listing",
    status: row.status,
    price: Number.isFinite(itemPrice) ? itemPrice : 0,
    hiddenFromSite: row.hidden_from_site === true,
    coverUrl: listingHeroSlideSrc(row.listing_images),
    pickupAvailable: row.local_pickup !== false,
    shippingAvailable: Boolean(row.shipping_available),
  }
}

/**
 * Admin terminal listing picker — searchable inventory including hidden listings.
 * Only peer marketplace sections in active or pending_sale status.
 */
export async function searchListingsForAdminTerminal(
  supabase: SupabaseClient,
  query: string,
  limit = 20,
): Promise<AdminTerminalListingSearchHit[]> {
  const q = query.trim()
  const cappedLimit = Math.min(Math.max(limit, 1), 50)

  let builder = supabase
    .from("listings")
    .select(TERMINAL_LISTING_SELECT)
    .in("section", PEER_LISTING_SECTIONS_FILTER)
    .in("status", ["active", "pending_sale"])
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(cappedLimit)

  if (q) {
    if (UUID_REGEX.test(q)) {
      builder = builder.eq("id", q)
    } else {
      const like = `%${escapeIlikePattern(q)}%`
      builder = builder.or(`title.ilike.${like},slug.ilike.${like},brand.ilike.${like}`)
    }
  }

  const { data, error } = await builder
  if (error) {
    console.error("[adminTerminalListings] search:", error.message)
    return []
  }

  return ((data ?? []) as SearchRow[]).map(toSearchHit)
}
