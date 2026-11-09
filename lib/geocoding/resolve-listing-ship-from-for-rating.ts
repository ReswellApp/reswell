import type { ShipFromParts } from "@/lib/geocoding/nominatim-reverse-us-ship-from"
import { reverseGeocodeShipFromParts } from "@/lib/geocoding/nominatim-reverse-us-ship-from"
import {
  normalizeUsStateProvinceForShipping,
  usStateTitleCaseName,
} from "@/lib/us-state-name-to-code"

/** Match `nominatim-reverse-us-ship-from` — required by Nominatim usage policy. */
const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "ReswellSurfMarketplace/1",
} as const

type NominatimSearchHit = {
  lat?: string
  lon?: string
  address?: Record<string, string>
}

function postcodeToFive(zip: string | undefined): string {
  const t = zip?.trim() ?? ""
  if (t.length < 5) return ""
  const five = /\d{5}/.exec(t)?.[0]
  return five ?? ""
}

function localityName(address: Record<string, string> | undefined): string {
  if (!address) return ""
  return (
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.municipality ||
    ""
  ).trim()
}

/**
 * Free-text "Ventura, CA" returns Ventura County first. That hit has no ZIP and
 * its centroid sits on a trail outside the city, so checkout cannot rate it.
 * Prefer the hit whose city/town actually matches the listing locality.
 */
export function pickNominatimCityHit(
  hits: NominatimSearchHit[],
  city: string,
): NominatimSearchHit | null {
  const wanted = city.trim().toLowerCase()
  if (!wanted) return null
  for (const hit of hits) {
    if (localityName(hit.address).toLowerCase() === wanted) return hit
  }
  return null
}

function finalizeShipFrom(parts: ShipFromParts | null): ShipFromParts | null {
  if (!parts) return null
  const postal = postcodeToFive(parts.postal_code)
  const state = normalizeUsStateProvinceForShipping("US", parts.state_province)
  const city = parts.city_locality.trim()
  if (postal.length < 5 || state.length !== 2 || !city) return null
  return {
    address_line1: parts.address_line1.trim() || "100 Main St",
    city_locality: city,
    state_province: state,
    postal_code: postal,
  }
}

/**
 * USPS-style ship-from locality for carrier rates.
 * Derives origin from the listing city + state shoppers see. Map pins are only
 * a fallback — a county centroid is not a ship-from.
 */
export async function resolveListingShipFromForRating(params: {
  city?: string | null
  state?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
}): Promise<ShipFromParts | null> {
  const cityTrim = params.city?.trim() ?? ""
  const stateTrim = params.state?.trim() ?? ""

  if (cityTrim && stateTrim) {
    const fromLocality = await forwardGeocodeUsCityStateShipFromParts(cityTrim, stateTrim)
    const finalized = finalizeShipFrom(fromLocality)
    if (finalized) return finalized
  }

  const latRaw = params.latitude
  const lngRaw = params.longitude
  const lat = latRaw != null && latRaw !== "" ? Number(latRaw) : NaN
  const lng = lngRaw != null && lngRaw !== "" ? Number(lngRaw) : NaN
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  return finalizeShipFrom(
    await reverseGeocodeShipFromParts(lat, lng, { fallbackCity: cityTrim || null }),
  )
}

async function fetchNominatimJson(url: URL): Promise<unknown | null> {
  try {
    const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function searchCityHits(city: string, stateCode: string): Promise<NominatimSearchHit[]> {
  const stateName = usStateTitleCaseName(stateCode) ?? stateCode
  const structured = new URL("https://nominatim.openstreetmap.org/search")
  structured.searchParams.set("format", "json")
  structured.searchParams.set("limit", "5")
  structured.searchParams.set("addressdetails", "1")
  structured.searchParams.set("countrycodes", "us")
  structured.searchParams.set("city", city)
  structured.searchParams.set("state", stateName)
  structured.searchParams.set("country", "United States")

  const structuredHits = await fetchNominatimJson(structured)
  const parsedStructured = Array.isArray(structuredHits)
    ? (structuredHits as NominatimSearchHit[])
    : []
  if (pickNominatimCityHit(parsedStructured, city)) return parsedStructured

  const freeText = new URL("https://nominatim.openstreetmap.org/search")
  freeText.searchParams.set("format", "json")
  freeText.searchParams.set("limit", "5")
  freeText.searchParams.set("addressdetails", "1")
  freeText.searchParams.set("countrycodes", "us")
  freeText.searchParams.set("q", `${city}, ${stateCode}, USA`)
  const freeHits = await fetchNominatimJson(freeText)
  return Array.isArray(freeHits) ? (freeHits as NominatimSearchHit[]) : parsedStructured
}

/** Nominatim city/state search → ship-from ZIP + a street line inside that city. */
async function forwardGeocodeUsCityStateShipFromParts(
  city: string,
  stateRaw: string,
): Promise<ShipFromParts | null> {
  const st = normalizeUsStateProvinceForShipping("US", stateRaw)
  if (!st || st.length < 2) return null

  const hit = pickNominatimCityHit(await searchCityHits(city, st), city)
  if (!hit?.address) return null

  const postal = postcodeToFive(hit.address.postcode)
  if (postal) {
    const road = [hit.address.house_number, hit.address.road].filter(Boolean).join(" ").trim()
    return {
      address_line1: road || "100 Main St",
      city_locality: localityName(hit.address) || city,
      state_province: normalizeUsStateProvinceForShipping("US", hit.address.state ?? st),
      postal_code: postal,
    }
  }

  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  // City boundaries often have no postcode. Reverse the city point for a ZIP
  // inside that city instead of the county centroid the free-text search returns.
  return reverseGeocodeShipFromParts(lat, lng, { fallbackCity: city })
}
