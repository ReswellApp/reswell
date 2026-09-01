import type { SupabaseClient } from "@supabase/supabase-js"
import type { SellerProfileListing } from "@/components/sellers/seller-profile-listings-panel"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"

/**
 * Columns needed for seller storefront tiles + inventory/sold filtering.
 * Intentionally not `*` — wide listing rows + nested images were ~780ms mean
 * on /sellers/[slug] (pg_stat_statements, Aug 2026).
 */
const SELLER_PROFILE_LISTING_SELECT = `
  id,
  slug,
  user_id,
  title,
  price,
  compare_at_price,
  status,
  section,
  local_pickup,
  shipping_available,
  condition,
  created_at,
  city,
  state,
  board_type,
  listing_images (url, thumbnail_url, is_primary),
  categories (name, slug)
`

/** Active inventory on a storefront — generous ceiling for power sellers. */
export const SELLER_PROFILE_INVENTORY_LIMIT = 300

/** Sold / past listings shown on the profile Sold tab. */
export const SELLER_PROFILE_PAST_LIMIT = 150

type SellerProfileListingRow = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: string | number
  compare_at_price?: number | string | null
  status: string | null
  section: string
  local_pickup?: boolean | null
  shipping_available?: boolean | null
  condition?: string | null
  created_at?: string | null
  city?: string | null
  state?: string | null
  board_type?: string | null
  listing_images?: { url: string; thumbnail_url?: string | null; is_primary?: boolean | null }[] | null
  categories?: { name?: string | null; slug?: string | null } | { name?: string | null; slug?: string | null }[] | null
}

export type SellerProfileListingsResult = {
  currentListings: SellerProfileListing[]
  pastListings: SellerProfileListing[]
  /** Raw rows used for directory tile meta (city / state / shipping). */
  tileMetaSource: Array<{
    city: string | null
    state: string | null
    shipping_available: boolean | null
  }>
  /** All listing ids returned (for favorites lookup). */
  listingIds: string[]
}

function normalizeCategories(
  categories: SellerProfileListingRow["categories"],
): SellerProfileListing["categories"] {
  if (categories == null) return null
  if (Array.isArray(categories)) return categories[0] ?? null
  return categories
}

function mapListing(row: SellerProfileListingRow): SellerProfileListing {
  return {
    id: row.id,
    slug: row.slug,
    user_id: row.user_id,
    title: row.title,
    price: row.price,
    compare_at_price: row.compare_at_price ?? null,
    status: row.status ?? "active",
    section: row.section,
    local_pickup: row.local_pickup,
    shipping_available: row.shipping_available,
    condition: row.condition,
    created_at: row.created_at,
    listing_images: row.listing_images,
    categories: normalizeCategories(row.categories),
    board_type: row.board_type,
  }
}

/**
 * Fetch seller storefront listings with narrow selects and bounded result sets.
 * Splits inventory vs sold so large sold history cannot inflate the hot path.
 *
 * Vacation / site-hidden inventory is excluded for everyone (including the owner);
 * owners manage those from My Listings. Sold history remains public.
 */
export async function fetchSellerProfileListings(
  supabase: SupabaseClient,
  sellerId: string,
): Promise<SellerProfileListingsResult> {
  const inventoryQuery = supabase
    .from("listings")
    .select(SELLER_PROFILE_LISTING_SELECT)
    .eq("user_id", sellerId)
    .in("section", PEER_LISTING_SECTIONS_FILTER)
    .in("status", ["active", "pending_sale"])
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(SELLER_PROFILE_INVENTORY_LIMIT)

  // Sold history stays public on the profile even after seller archive/cleanup.
  const pastQuery = supabase
    .from("listings")
    .select(SELLER_PROFILE_LISTING_SELECT)
    .eq("user_id", sellerId)
    .in("section", PEER_LISTING_SECTIONS_FILTER)
    .eq("status", "sold")
    .order("created_at", { ascending: false })
    .limit(SELLER_PROFILE_PAST_LIMIT)

  const [inventoryRes, pastRes] = await Promise.all([inventoryQuery, pastQuery])

  if (inventoryRes.error) {
    console.error("[sellerProfileListings] inventory:", inventoryRes.error.message)
  }
  if (pastRes.error) {
    console.error("[sellerProfileListings] past:", pastRes.error.message)
  }

  const inventoryRows = (inventoryRes.data ?? []) as SellerProfileListingRow[]
  const pastRows = (pastRes.data ?? []) as SellerProfileListingRow[]

  const currentListings = inventoryRows.map(mapListing)
  const pastListings = pastRows.map(mapListing)

  const tileMetaSource = [...inventoryRows, ...pastRows].map((row) => ({
    city: row.city ?? null,
    state: row.state ?? null,
    shipping_available: row.shipping_available ?? null,
  }))

  const listingIds = [...currentListings, ...pastListings].map((l) => l.id)

  return {
    currentListings,
    pastListings,
    tileMetaSource,
    listingIds,
  }
}
