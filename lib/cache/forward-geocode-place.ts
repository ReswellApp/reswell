import { unstable_cache } from "next/cache"
import { forwardGeocodePlaceForServer } from "@/lib/maps/forward-geocode-server"
import { normalizeForwardGeocodePlaceKey } from "@/lib/utils/boards-browse-geocode"

/** Shared place → lat/lng cache for browse HTML (location fallback + URL persist). */
export const FORWARD_GEOCODE_PLACE_CACHE_TAG = "forward-geocode-place"
/** Short TTL: cities are stable, but a bad geocoder result should not stick for days. */
export const FORWARD_GEOCODE_PLACE_REVALIDATE_SECONDS = 60 * 60

async function loadForwardGeocodePlace(
  placeKey: string,
): Promise<{ lat: number; lng: number } | null> {
  return forwardGeocodePlaceForServer(placeKey)
}

const getCachedForwardGeocodePlaceRow = unstable_cache(
  loadForwardGeocodePlace,
  ["forward-geocode-place", "v1"],
  {
    revalidate: FORWARD_GEOCODE_PLACE_REVALIDATE_SECONDS,
    tags: [FORWARD_GEOCODE_PLACE_CACHE_TAG],
  },
)

export async function getCachedForwardGeocodePlace(
  place: string,
): Promise<{ lat: number; lng: number } | null> {
  const key = normalizeForwardGeocodePlaceKey(place)
  if (key.length < 2) return null
  return getCachedForwardGeocodePlaceRow(key)
}
