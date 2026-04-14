import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"
import type { RateQuoteAddressFields } from "@/lib/shipping/rate-address"

const HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en",
  "User-Agent": "ReswellSurfMarketplace/1",
}

/**
 * Reverse geocode US-ish coordinates into a ShipEngine-style address (used for rate quotes).
 * Uses OpenStreetMap Nominatim — same source as `/api/geocode/structured`.
 */
export async function reverseGeocodeUsLatLngToShipFrom(
  lat: number,
  lng: number,
): Promise<RateQuoteAddressFields | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const url = new URL("https://nominatim.openstreetmap.org/reverse")
  url.searchParams.set("lat", String(lat))
  url.searchParams.set("lon", String(lng))
  url.searchParams.set("format", "json")
  url.searchParams.set("addressdetails", "1")

  try {
    const res = await fetch(url.toString(), { headers: HEADERS })
    if (!res.ok) return null
    const data = (await res.json()) as { address?: Record<string, string> }
    const a = data.address
    if (!a) return null

    const house = (a.house_number || "").trim()
    const road = (a.road || a.pedestrian || a.path || "").trim()
    let address_line1 = [house, road].filter(Boolean).join(" ").trim()
    if (!address_line1) {
      address_line1 =
        (a.amenity || a.building || a.retail || a.house_name || "").trim() || "General delivery"
    }

    const city_locality = (
      a.city ||
      a.town ||
      a.village ||
      a.hamlet ||
      a.municipality ||
      a.suburb ||
      ""
    ).trim()

    const rawState = (a.state || a.region || "").trim()
    const postal_code = (a.postcode || "").trim()
    const rawCc = (a.country_code || "").trim().toUpperCase()
    const country_code = rawCc.length === 2 ? rawCc : "US"
    if (country_code !== "US") return null

    const state_province = rawState
      ? normalizeUsStateProvinceForShipping(country_code, rawState)
      : ""

    if (!city_locality || !state_province || !postal_code) return null

    return {
      name: "Seller",
      phone: "",
      company_name: "",
      address_line1,
      address_line2: "",
      city_locality,
      state_province,
      postal_code,
      country_code: "US",
      residential: "yes",
    }
  } catch {
    return null
  }
}
