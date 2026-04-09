import { NextRequest, NextResponse } from "next/server"

const HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en",
  "User-Agent": "ReswellSurfMarketplace/1",
}

/**
 * Reverse geocode lat/lng into fields suitable for ShipEngine-style address forms.
 * Uses OpenStreetMap Nominatim (same as /api/geocode/suggest).
 */
export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"))
  const lng = Number(request.nextUrl.searchParams.get("lng"))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Invalid lat or lng" }, { status: 400 })
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse")
  url.searchParams.set("lat", String(lat))
  url.searchParams.set("lon", String(lng))
  url.searchParams.set("format", "json")
  url.searchParams.set("addressdetails", "1")

  try {
    const res = await fetch(url.toString(), { headers: HEADERS, next: { revalidate: 86_400 } })
    if (!res.ok) {
      return NextResponse.json({ error: "Reverse geocode failed" }, { status: 502 })
    }
    const data = (await res.json()) as { address?: Record<string, string> }
    const a = data.address
    if (!a) {
      return NextResponse.json({ error: "No address" }, { status: 404 })
    }

    const house = (a.house_number || "").trim()
    const road = (a.road || a.pedestrian || a.path || "").trim()
    let address_line1 = [house, road].filter(Boolean).join(" ").trim()
    if (!address_line1) {
      address_line1 =
        (a.amenity || a.building || a.retail || a.house_name || "").trim() || ""
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

    const state_province = (a.state || a.region || "").trim()
    const postal_code = (a.postcode || "").trim()
    const rawCc = (a.country_code || "").trim().toUpperCase()
    const country_code = rawCc.length === 2 ? rawCc : "US"

    return NextResponse.json({
      address_line1: address_line1 || null,
      city_locality: city_locality || null,
      state_province: state_province || null,
      postal_code: postal_code || null,
      country_code,
    })
  } catch {
    return NextResponse.json({ error: "Reverse geocode failed" }, { status: 502 })
  }
}
