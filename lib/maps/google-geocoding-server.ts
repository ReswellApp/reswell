/// <reference types="google.maps" />

import { parseGoogleAddressComponents } from "@/lib/maps/parse-google-address-components"
import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"

const GEOCODE_JSON = "https://maps.googleapis.com/maps/api/geocode/json"
/** Avoid blocking rate estimates when Google Geocoding is slow or misconfigured. */
const GEOCODE_FETCH_TIMEOUT_MS = 6_000

/** Prefer a server-only key with Geocoding API + IP restriction; falls back to the public browser key. */
export function getGoogleGeocodingApiKey(): string | null {
  const k =
    process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  return k || null
}

type GeocodeResult = {
  formatted_address: string
  place_id?: string
  geometry: { location: { lat: number; lng: number } }
  address_components?: google.maps.GeocoderAddressComponent[]
}

type GeocodeJsonResponse = {
  status: string
  error_message?: string
  results?: GeocodeResult[]
}

async function fetchGeocodeJson(params: URLSearchParams): Promise<GeocodeJsonResponse | null> {
  const key = getGoogleGeocodingApiKey()
  if (!key) return null
  params.set("key", key)
  const url = `${GEOCODE_JSON}?${params.toString()}`
  try {
    const res = await fetch(url, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(GEOCODE_FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    return (await res.json()) as GeocodeJsonResponse
  } catch {
    return null
  }
}

/** Forward geocode: free-text or ZIP — returns first result centroid. */
export async function googleForwardGeocode(
  query: string,
): Promise<{ lat: number; lng: number; formatted_address?: string } | null> {
  const q = query.trim()
  if (q.length < 2) return null
  const params = new URLSearchParams()
  params.set("address", q)
  params.set("region", "us")
  const data = await fetchGeocodeJson(params)
  if (!data || data.status !== "OK" || !data.results?.[0]) return null
  const r = data.results[0]
  const loc = r.geometry?.location
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return null
  return { lat: loc.lat, lng: loc.lng, formatted_address: r.formatted_address }
}

/** Reverse geocode lat/lng into display label (city, state style when possible). */
export async function googleReverseGeocodeLabel(lat: number, lng: number): Promise<string | null> {
  const params = new URLSearchParams()
  params.set("latlng", `${lat},${lng}`)
  const data = await fetchGeocodeJson(params)
  if (!data || data.status !== "OK" || !data.results?.[0]) return null
  return data.results[0].formatted_address ?? null
}

export type StructuredFromLatLng = {
  address_line1: string | null
  city_locality: string | null
  state_province: string | null
  postal_code: string | null
  country_code: string
}

/** Reverse geocode into ShipEngine-style fields (same shape as /api/geocode/structured). */
export async function googleReverseStructured(lat: number, lng: number): Promise<StructuredFromLatLng | null> {
  const params = new URLSearchParams()
  params.set("latlng", `${lat},${lng}`)
  const data = await fetchGeocodeJson(params)
  if (!data || data.status !== "OK" || !data.results?.[0]?.address_components) return null
  const parsed = parseGoogleAddressComponents(data.results[0].address_components)
  const cc = (parsed.country || "US").slice(0, 2).toUpperCase()
  const state = parsed.state
    ? normalizeUsStateProvinceForShipping(cc, parsed.state)
    : ""
  return {
    address_line1: parsed.line1.trim() || null,
    city_locality: parsed.city.trim() || null,
    state_province: state || null,
    postal_code: parsed.postal_code.trim() || null,
    country_code: cc,
  }
}

/** US ZIP → city/state + approximate coordinates (for rate estimates). */
export async function googleGeocodeUsZip(zip5: string): Promise<{
  lat: number
  lng: number
  postal_code: string
  city_locality: string
  state_province: string
  address_line1: string
} | null> {
  const five = zip5.replace(/\D/g, "").slice(0, 5)
  if (five.length !== 5) return null
  const params = new URLSearchParams()
  params.set("components", `postal_code:${five}|country:US`)
  const data = await fetchGeocodeJson(params)
  if (!data || data.status !== "OK" || !data.results?.[0]) return null
  const r = data.results[0]
  const loc = r.geometry?.location
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return null
  const parsed = parseGoogleAddressComponents(r.address_components ?? [])
  const cc = (parsed.country || "US").slice(0, 2).toUpperCase()
  const city = parsed.city.trim()
  const state = parsed.state ? normalizeUsStateProvinceForShipping(cc, parsed.state) : ""
  if (!city || !state) return null
  return {
    lat: loc.lat,
    lng: loc.lng,
    postal_code: five,
    city_locality: city,
    state_province: state,
    address_line1: "100 Main St",
  }
}

export type GoogleResolvedStreet = {
  formattedAddress: string
  placeId: string
  latitude: number
  longitude: number
  line1: string
  line2: string
  city: string
  state: string
  postalCode: string
  country: string
}

/**
 * Resolve a street with the existing Geocoding API. Place id wins when it resolves.
 * Returns null when Google has no street-number result. Does not call another provider.
 */
export async function googleResolveStreetAddress(input: {
  placeId?: string | null
  query?: string | null
}): Promise<GoogleResolvedStreet | null> {
  const placeId = input.placeId?.trim() ?? ""
  if (placeId) {
    const params = new URLSearchParams()
    params.set("place_id", placeId)
    const byPlace = await firstStreetResult(params)
    if (byPlace) return byPlace
  }

  const query = input.query?.trim() ?? ""
  if (query.length < 5) return null
  const params = new URLSearchParams()
  params.set("address", query)
  params.set("components", "country:US")
  params.set("region", "us")
  return firstStreetResult(params)
}

async function firstStreetResult(params: URLSearchParams): Promise<GoogleResolvedStreet | null> {
  const data = await fetchGeocodeJson(params)
  if (!data || data.status !== "OK" || !data.results?.length) return null
  for (const result of data.results) {
    const street = mapStreetResult(result)
    if (street) return street
  }
  return null
}

function mapStreetResult(result: GeocodeResult): GoogleResolvedStreet | null {
  const parsed = parseGoogleAddressComponents(result.address_components ?? [])
  const line1 = parsed.line1.trim()
  if (!/^\d/.test(line1)) return null
  const city = parsed.city.trim()
  const postalCode = parsed.postal_code.trim()
  if (!city || !postalCode) return null
  const loc = result.geometry?.location
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return null
  const placeId = result.place_id?.trim() ?? ""
  if (!placeId) return null
  const country = (parsed.country || "US").slice(0, 2).toUpperCase()
  const state = parsed.state ? normalizeUsStateProvinceForShipping(country, parsed.state) : ""
  return {
    formattedAddress: result.formatted_address?.trim() || line1,
    placeId,
    latitude: loc.lat,
    longitude: loc.lng,
    line1,
    line2: parsed.line2.trim(),
    city,
    state,
    postalCode,
    country,
  }
}
