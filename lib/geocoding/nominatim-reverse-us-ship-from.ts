const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "ReswellSurfMarketplace/1",
} as const

export type ShipFromParts = {
  address_line1: string
  city_locality: string
  state_province: string
  postal_code: string
}

/**
 * Reverse geocode US coordinates into fields suitable for ShipEngine rate quotes.
 * Uses a generic street line when the map has no street-level detail.
 */
export async function reverseGeocodeShipFromParts(
  lat: number,
  lng: number,
): Promise<ShipFromParts | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const url = new URL("https://nominatim.openstreetmap.org/reverse")
  url.searchParams.set("format", "json")
  url.searchParams.set("lat", String(lat))
  url.searchParams.set("lon", String(lng))
  url.searchParams.set("zoom", "18")
  url.searchParams.set("addressdetails", "1")

  let data: unknown
  try {
    const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS })
    if (!res.ok) return null
    data = await res.json()
  } catch {
    return null
  }

  const root = data as { address?: Record<string, string> }
  const a = root.address
  if (!a) return null

  const road = [a.house_number, a.road].filter(Boolean).join(" ").trim()
  const address_line1 = road || "100 Main St"

  const city =
    a.city || a.town || a.village || a.hamlet || a.municipality || a.suburb || ""
  const state = a.state || ""
  const rawZip = (a.postcode || "").trim()
  const postal_code = rawZip.length >= 5 ? rawZip.slice(0, 5) : rawZip

  if (!city || !state) return null

  return {
    address_line1,
    city_locality: city,
    state_province: state,
    postal_code,
  }
}
