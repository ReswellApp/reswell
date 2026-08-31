import type { SupabaseClient } from "@supabase/supabase-js"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import { applyListingsLocationTextFilter } from "@/lib/listing-location-or-filter"

export const CITY_TOP_SELLERS_LISTINGS_FETCH_CAP = 2000

export type CityTopSellerListingSeed = {
  user_id: string
  city: string | null
  state: string | null
  status: string | null
  shipping_available: boolean | null
  listing_images: ListingImageForCard[] | null
}

export type CityTopSellerProfileRow = {
  id: string
  seller_slug: string | null
  display_name: string | null
  avatar_url: string | null
  city: string | null
  is_shop: boolean | null
  shop_name: string | null
  shop_logo_url: string | null
  shop_verified: boolean | null
  sales_count: number | null
}

const PROFILE_FIELDS =
  "id, seller_slug, display_name, avatar_url, city, is_shop, shop_name, shop_logo_url, shop_verified, sales_count" as const

/**
 * Active + sold surfboard listings in a city, used to associate sellers with that market.
 */
export async function listCityTopSellerListingSeeds(
  supabase: SupabaseClient,
  locationLabel: string,
): Promise<CityTopSellerListingSeed[]> {
  let query = supabase
    .from("listings")
    .select(
      "user_id, city, state, status, shipping_available, listing_images (url, thumbnail_url, is_primary)",
    )
    .eq("section", "surfboards")
    .in("status", ["active", "sold"])
    .eq("hidden_from_site", false)
    .is("archived_at", null)

  query = applyListingsLocationTextFilter(query, locationLabel)
  query = query.limit(CITY_TOP_SELLERS_LISTINGS_FETCH_CAP)

  const { data, error } = await query
  if (error) {
    console.error("[city-top-sellers] listing seeds:", error.message)
    return []
  }

  return (data ?? []) as CityTopSellerListingSeed[]
}

export async function listCityTopSellerProfiles(
  supabase: SupabaseClient,
  sellerIds: string[],
): Promise<CityTopSellerProfileRow[]> {
  if (sellerIds.length === 0) return []

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .in("id", sellerIds)
    .gte("sales_count", 1)

  if (error) {
    console.error("[city-top-sellers] profiles:", error.message)
    return []
  }

  return (data ?? []) as CityTopSellerProfileRow[]
}
