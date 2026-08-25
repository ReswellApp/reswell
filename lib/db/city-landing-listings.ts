import type { SupabaseClient } from "@supabase/supabase-js"
import type { RecentListing } from "@/components/recent-feed-client"
import type { CityLandingListing } from "@/lib/types/city-landing"
import { boardLengthLabelFromDimensionsColumn } from "@/lib/listing-dimensions-storage"
import { applyListingsLocationTextFilter } from "@/lib/listing-location-or-filter"
import { isListingDiscoveryEligible } from "@/lib/listing-public-visibility"

const CITY_LANDING_LISTING_SELECT = `
  id,
  slug,
  user_id,
  title,
  price,
  compare_at_price,
  condition,
  section,
  status,
  city,
  state,
  shipping_available,
  local_pickup,
  brand,
  model,
  board_type,
  fins_setup,
  fin_system,
  construction,
  length_total_inches,
  volume_liters,
  dimensions,
  created_at,
  updated_at,
  hidden_from_site,
  archived_at,
  listing_images (url, is_primary),
  profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count, shop_verified),
  categories (name, slug)
`

type CityLandingListingRow = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  compare_at_price?: number | string | null
  condition: string
  section: string
  status?: string
  hidden_from_site?: boolean | null
  archived_at?: string | null
  city?: string | null
  state?: string | null
  shipping_available?: boolean | null
  local_pickup?: boolean | null
  brand?: string | null
  model?: string | null
  board_type?: string | null
  fins_setup?: string | null
  fin_system?: string | null
  construction?: string | null
  length_total_inches?: number | null
  volume_liters?: number | null
  dimensions?: string | null
  updated_at?: string | null
  listing_images?: RecentListing["listing_images"]
  profiles?: RecentListing["profiles"]
  categories?: RecentListing["categories"]
}

function mapRowToRecentListing(row: CityLandingListingRow): CityLandingListing {
  const boardLength = boardLengthLabelFromDimensionsColumn(row.dimensions) ?? null
  return {
    id: row.id,
    slug: row.slug ?? null,
    user_id: row.user_id,
    title: row.title,
    price: row.price,
    compare_at_price: row.compare_at_price ?? null,
    condition: row.condition,
    section: row.section,
    status: row.status,
    city: row.city,
    state: row.state,
    shipping_available: row.shipping_available ?? undefined,
    local_pickup: row.local_pickup,
    brand: row.brand ?? null,
    model: row.model ?? null,
    board_type: row.board_type,
    fins_setup: row.fins_setup ?? null,
    fin_system: row.fin_system ?? null,
    construction: row.construction ?? null,
    length_total_inches: row.length_total_inches ?? null,
    volume_liters: row.volume_liters ?? null,
    dimensions: row.dimensions ?? null,
    board_length: boardLength,
    updated_at: row.updated_at ?? null,
    listing_images: row.listing_images,
    profiles: row.profiles,
    categories: row.categories,
  }
}

/**
 * Active, site-visible surfboard listings in a city (geocoder-style label, e.g. "Santa Barbara, CA").
 */
export async function listCityLandingListings(
  supabase: SupabaseClient,
  locationLabel: string,
  limit: number,
): Promise<CityLandingListing[]> {
  const fetchLimit = Math.max(1, limit + 20)

  let query = supabase
    .from("listings")
    .select(CITY_LANDING_LISTING_SELECT)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .eq("section", "surfboards")

  query = applyListingsLocationTextFilter(query, locationLabel)
  query = query.order("created_at", { ascending: false }).limit(fetchLimit)

  const { data, error } = await query
  if (error) {
    console.error("[listCityLandingListings]", error.message)
    throw new Error("Could not load city listings")
  }

  return (data ?? [])
    .map((row) => mapRowToRecentListing(row as CityLandingListingRow))
    .filter((listing) =>
      isListingDiscoveryEligible({
        status: listing.status ?? "active",
        title: listing.title,
      }),
    )
    .slice(0, limit)
}
