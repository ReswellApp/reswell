import { parseGoogleAddressComponents } from "@/lib/maps/parse-google-address-components"
import { getGoogleGeocodingApiKey } from "@/lib/maps/google-geocoding-server"
import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"

/**
 * Legacy Places web service. The Maps JavaScript key used by `/sell` allows this
 * endpoint. Places API (New) REST autocomplete is blocked on that key.
 */
const AUTOCOMPLETE_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
const FETCH_TIMEOUT_MS = 6_000

export type GoogleRegionPrediction = {
  placeId: string
  label: string
}

export type GooglePlaceLocation = {
  label: string
  lat: number
  lng: number
  city: string
  state: string
}

/** City and region rows from the Places Autocomplete web service. */
export function parseGoogleRegionPredictions(body: unknown): GoogleRegionPrediction[] {
  if (!body || typeof body !== "object" || !("predictions" in body)) return []
  const predictions = (body as { predictions?: unknown }).predictions
  if (!Array.isArray(predictions)) return []
  const rows: GoogleRegionPrediction[] = []
  for (const entry of predictions) {
    if (!entry || typeof entry !== "object") continue
    const raw = entry as { place_id?: unknown; description?: unknown }
    const placeId = typeof raw.place_id === "string" ? raw.place_id.trim() : ""
    const label = typeof raw.description === "string" ? raw.description.trim() : ""
    if (!placeId || !label) continue
    rows.push({ placeId, label })
  }
  return rows
}

/** City, state, and coordinates from a Place Details result. */
export function parseGooglePlaceLocation(body: unknown): GooglePlaceLocation | null {
  if (!body || typeof body !== "object" || !("result" in body)) return null
  const result = (body as { result?: unknown }).result
  if (!result || typeof result !== "object") return null
  const raw = result as {
    formatted_address?: unknown
    geometry?: { location?: { lat?: unknown; lng?: unknown } }
    address_components?: unknown
  }
  const lat = raw.geometry?.location?.lat
  const lng = raw.geometry?.location?.lng
  if (typeof lat !== "number" || typeof lng !== "number") return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const components = Array.isArray(raw.address_components)
    ? raw.address_components.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return []
        const component = entry as { long_name?: unknown; short_name?: unknown; types?: unknown }
        const longName = typeof component.long_name === "string" ? component.long_name : ""
        const shortName = typeof component.short_name === "string" ? component.short_name : ""
        const types = Array.isArray(component.types)
          ? component.types.filter((type): type is string => typeof type === "string")
          : []
        if (!longName && !shortName) return []
        return [{ long_name: longName, short_name: shortName || longName, types }]
      })
    : []
  const parsed = parseGoogleAddressComponents(components)
  const state = normalizeUsStateProvinceForShipping(parsed.country || "US", parsed.state)
  const city = parsed.city.trim()
  const label = typeof raw.formatted_address === "string" ? raw.formatted_address.trim() : ""
  if (!city || !state) return null
  return {
    label: label || [city, state].filter(Boolean).join(", "),
    lat,
    lng,
    city,
    state,
  }
}

async function placesGet(url: URL): Promise<unknown | null> {
  const key = getGoogleGeocodingApiKey()
  if (!key) return null
  url.searchParams.set("key", key)
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!response.ok) return null
    const body = (await response.json()) as { status?: string }
    if (body.status !== "OK") return null
    return body
  } catch {
    return null
  }
}

/** US city, ZIP, and region predictions. Empty when Places is unavailable. */
export async function fetchGoogleRegionPredictions(input: string): Promise<GoogleRegionPrediction[]> {
  const query = input.trim()
  if (query.length < 2) return []
  const url = new URL(AUTOCOMPLETE_URL)
  url.searchParams.set("input", query)
  url.searchParams.set("types", "(regions)")
  url.searchParams.set("components", "country:us")
  const body = await placesGet(url)
  if (!body) return []
  return parseGoogleRegionPredictions(body).slice(0, 8)
}

/** Resolves a Places autocomplete row into city, state, and coordinates. */
export async function fetchGooglePlaceLocation(placeId: string): Promise<GooglePlaceLocation | null> {
  const id = placeId.trim()
  if (!id || id.length > 300) return null
  const url = new URL(DETAILS_URL)
  url.searchParams.set("place_id", id)
  url.searchParams.set("fields", "address_component,geometry,formatted_address")
  const body = await placesGet(url)
  if (!body) return null
  return parseGooglePlaceLocation(body)
}
