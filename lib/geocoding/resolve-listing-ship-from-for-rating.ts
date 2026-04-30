import type { ShipFromParts } from "@/lib/geocoding/nominatim-reverse-us-ship-from"
import { reverseGeocodeShipFromParts } from "@/lib/geocoding/nominatim-reverse-us-ship-from"
import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"

/** Match `nominatim-reverse-us-ship-from` — required by Nominatim usage policy. */
const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "ReswellSurfMarketplace/1",
} as const

function postcodeToFive(zip: string | undefined): string {
  const t = zip?.trim() ?? ""
  if (t.length < 5) return ""
  const five = /\d{5}/.exec(t)?.[0]
  return five ?? ""
}

/**
 * USPS-style ship-from locality for SurfEngine /rates parity with `/admin/shipping`:
 * derives origin from the listing city + state shoppers see instead of noisy map-pin
 * reverse lookups (pins can land in suburbs or mismatched Postal towns).
 *
 * Fallback: reverse-geocode `{ latitude, longitude }` when locality search fails or has no ZIP.
 */
export async function resolveListingShipFromForRating(params: {
  city?: string | null
  state?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
}): Promise<ShipFromParts | null> {
  const latRaw = params.latitude
  const lngRaw = params.longitude
  const lat = latRaw != null && latRaw !== "" ? Number(latRaw) : NaN
  const lng = lngRaw != null && lngRaw !== "" ? Number(lngRaw) : NaN
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const cityTrim = params.city?.trim() ?? ""
  const stateTrim = params.state?.trim() ?? ""

  if (cityTrim && stateTrim) {
    const fromLocality = await forwardGeocodeUsCityStateShipFromParts(cityTrim, stateTrim)
    if (fromLocality?.postal_code?.length >= 5) return fromLocality
  }

  return reverseGeocodeShipFromParts(lat, lng)
}

/** Nominatim search `{city}, ST, USA` → ship-from ZIP + centroid street line. */
async function forwardGeocodeUsCityStateShipFromParts(city: string, stateRaw: string): Promise<ShipFromParts | null> {
  const st = normalizeUsStateProvinceForShipping("US", stateRaw)
  if (!st || st.length < 2) return null

  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", "1")
  url.searchParams.set("addressdetails", "1")
  url.searchParams.set("countrycodes", "us")
  url.searchParams.set("q", `${city}, ${st}, USA`)

  let hits: unknown
  try {
    const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS })
    if (!res.ok) return null
    hits = await res.json()
  } catch {
    return null
  }

  if (!Array.isArray(hits) || hits.length === 0) return null

  const row = hits[0] as { address?: Record<string, string> }
  const a = row.address
  if (!a) return null

  const postal = postcodeToFive(a.postcode)
  if (!postal) return null

  const road = [a.house_number, a.road].filter(Boolean).join(" ").trim()
  const address_line1 = road || "100 Main St"
  const cityOut =
    a.city || a.town || a.village || a.hamlet || a.municipality || a.suburb || city
  const stateOutRaw = a.state ?? st
  if (!cityOut || !stateOutRaw) return null

  return {
    address_line1,
    city_locality: cityOut,
    state_province: normalizeUsStateProvinceForShipping("US", stateOutRaw),
    postal_code: postal.length >= 5 ? postal.slice(0, 5) : postal,
  }
}
