import { getCachedTopCitiesDirectory } from "@/lib/cache/top-cities-directory"
import {
  boardsBrowseLocationHref,
  CITY_LANDING_LISTING_CAP,
  findCityByLandingSlug,
} from "@/lib/city-landing-path"
import { listCityLandingListings } from "@/lib/db/city-landing-listings"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { CityLandingPageData } from "@/lib/types/city-landing"

function offersLocalPickup(listing: { local_pickup?: boolean | null }): boolean {
  return listing.local_pickup !== false
}

export async function getCityLandingPage(slug: string): Promise<CityLandingPageData | null> {
  const directory = await getCachedTopCitiesDirectory()
  const city = findCityByLandingSlug(directory.cities, slug)
  if (!city) return null

  const supabase = createServiceRoleClient()
  const listings = await listCityLandingListings(
    supabase,
    city.label,
    CITY_LANDING_LISTING_CAP,
  )

  return {
    city,
    listings,
    pickupCount: listings.filter(offersLocalPickup).length,
    hasMore: listings.length >= CITY_LANDING_LISTING_CAP,
    boardsBrowseHref: boardsBrowseLocationHref(city.label),
  }
}
