import { getGoogleGeocodingApiKey, googleForwardGeocode } from "@/lib/maps/google-geocoding-server"

const NOMINATIM_HEADERS = { Accept: "application/json", "User-Agent": "ReswellSurfMarketplace/1" }

async function forwardGeocodeNominatim(q: string): Promise<{ lat: number; lng: number } | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("q", q)
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", "1")

  const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS })
  if (!res.ok) return null

  const data = await res.json()
  const first = Array.isArray(data) ? data[0] : null
  if (!first?.lat || !first?.lon) return null

  return {
    lat: Number(first.lat),
    lng: Number(first.lon),
  }
}

/**
 * Resolve a free-text place (city, "City, ST", ZIP) to coordinates for server-side browse.
 * Matches `/api/geocode?q=` behavior (Google when configured, else Nominatim).
 */
export async function forwardGeocodePlaceForServer(
  place: string,
): Promise<{ lat: number; lng: number } | null> {
  const q = place.trim()
  if (q.length < 2) return null

  if (getGoogleGeocodingApiKey()) {
    const g = await googleForwardGeocode(q)
    if (g) return { lat: g.lat, lng: g.lng }
  }

  return forwardGeocodeNominatim(q)
}
