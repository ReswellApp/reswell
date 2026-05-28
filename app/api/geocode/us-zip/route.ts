import { NextRequest, NextResponse } from "next/server"

import { lookupUsZipViaNominatim } from "@/lib/geocode/us-zip-lookup"
import { getGoogleGeocodingApiKey, googleGeocodeUsZip } from "@/lib/maps/google-geocoding-server"

export const dynamic = "force-dynamic"

/**
 * Resolve a US ZIP code to city/state for shipping rate estimates.
 * Uses fast Nominatim first; Google Geocoding is a short-timeout fallback when configured.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("zip")?.trim() ?? ""
  const five = raw.replace(/\D/g, "").slice(0, 5)
  if (five.length !== 5) {
    return NextResponse.json({ error: "Enter a 5-digit US ZIP code" }, { status: 400 })
  }

  const nominatim = await lookupUsZipViaNominatim(five)
  if (nominatim) {
    return NextResponse.json(nominatim)
  }

  if (getGoogleGeocodingApiKey()) {
    const g = await googleGeocodeUsZip(five)
    if (g) {
      return NextResponse.json({
        postal_code: g.postal_code,
        city_locality: g.city_locality,
        state_province: g.state_province,
        address_line1: g.address_line1,
      })
    }
  }

  return NextResponse.json({ error: "ZIP not found" }, { status: 404 })
}
