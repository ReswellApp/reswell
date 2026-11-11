import {
  mobilePlaceDetailsSchema,
  mobilePlaceSuggestionsSchema,
  type MobilePlaceDetails,
  type MobilePlaceSuggestions,
} from "@reswell/api-contract"
import { fetchGooglePlaceLocation, fetchGoogleRegionPredictions } from "@/lib/maps/google-places-region"
import { redisGetOrSet } from "@/lib/redis/cache"
import { REDIS_TTL_SECONDS, redisPlacesSuggestKey } from "@/lib/redis/keys"
import { suggestGeocodePlaces } from "@/lib/services/geocodeSuggestions"
import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"

/**
 * Listing-location dropdown. Google Places first — the same source as `/sell` —
 * then the Photon/Nominatim suggestions when Places returns nothing.
 */
export async function suggestMobilePlaces(query: string): Promise<MobilePlaceSuggestions> {
  return redisGetOrSet(
    redisPlacesSuggestKey(query),
    REDIS_TTL_SECONDS.placesSuggest,
    () => loadMobilePlaces(query),
  )
}

async function loadMobilePlaces(query: string): Promise<MobilePlaceSuggestions> {
  const google = await fetchGoogleRegionPredictions(query)
  if (google.length > 0) {
    return mobilePlaceSuggestionsSchema.parse({
      suggestions: google.map((row) => ({
        label: row.label,
        place_id: row.placeId,
        lat: null,
        lng: null,
        city: "",
        state: "",
      })),
    })
  }

  const fallback = await suggestGeocodePlaces(query, false)
  const suggestions = fallback.flatMap((row) => {
    const city = row.city.trim()
    const state = normalizeUsStateProvinceForShipping("US", row.state).trim()
    if (!city || !state || !Number.isFinite(row.lat) || !Number.isFinite(row.lng)) return []
    return [
      {
        label: row.label,
        place_id: null,
        lat: row.lat,
        lng: row.lng,
        city,
        state,
      },
    ]
  })
  return mobilePlaceSuggestionsSchema.parse({ suggestions })
}

/** City and state for a Google place chosen from the dropdown. */
export async function readMobilePlace(placeId: string): Promise<MobilePlaceDetails | null> {
  const place = await fetchGooglePlaceLocation(placeId)
  if (!place) return null
  const parsed = mobilePlaceDetailsSchema.safeParse({
    label: place.label,
    place_id: placeId.trim(),
    lat: place.lat,
    lng: place.lng,
    city: place.city,
    state: place.state,
  })
  return parsed.success ? parsed.data : null
}
