import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "ReswellSurfMarketplace/1",
} as const

/**
 * Resolve a US ZIP code to city/state for shipping rate estimates (Nominatim).
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("zip")?.trim() ?? ""
  const five = raw.replace(/\D/g, "").slice(0, 5)
  if (five.length !== 5) {
    return NextResponse.json({ error: "Enter a 5-digit US ZIP code" }, { status: 400 })
  }

  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("postalcode", five)
  url.searchParams.set("countrycodes", "us")
  url.searchParams.set("format", "json")
  url.searchParams.set("addressdetails", "1")
  url.searchParams.set("limit", "1")

  let data: unknown
  try {
    const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS })
    if (!res.ok) {
      return NextResponse.json({ error: "ZIP lookup failed" }, { status: 502 })
    }
    data = await res.json()
  } catch {
    return NextResponse.json({ error: "ZIP lookup failed" }, { status: 502 })
  }

  const first = Array.isArray(data) ? data[0] : null
  const addr = first && typeof first === "object" && first !== null && "address" in first
    ? (first as { address?: Record<string, string> }).address
    : undefined

  if (!addr) {
    return NextResponse.json({ error: "ZIP not found" }, { status: 404 })
  }

  const city =
    addr.city || addr.town || addr.village || addr.hamlet || addr.municipality || ""
  const state = addr.state || ""

  if (!city || !state) {
    return NextResponse.json({ error: "Could not resolve city/state for this ZIP" }, { status: 404 })
  }

  return NextResponse.json({
    postal_code: five,
    city_locality: city,
    state_province: state,
    /** Generic line for carrier rating (lane-based pricing). */
    address_line1: "100 Main St",
  })
}
