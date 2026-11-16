import { NextRequest, NextResponse } from "next/server"

import { parseDropoffNearbyOrigin } from "@/lib/dropoff-location-nearby"
import { listPublicDropoffLocations } from "@/lib/services/listPublicDropoffLocations"

/**
 * Public dropoff sites for `/sell`. Route handler (not a Server Action) so this
 * never POSTs to `/sell` and aborts an in-flight listing save.
 *
 * Pass `lat` and `lng` from the listing origin (city/ZIP pin) to receive only
 * sites close enough to drop off. Website `/sell` and the Expo app both send
 * those params; without an origin this returns no cities.
 */
export async function GET(request: NextRequest) {
  try {
    const near = parseDropoffNearbyOrigin(
      request.nextUrl.searchParams.get("lat"),
      request.nextUrl.searchParams.get("lng"),
    )
    const locations = await listPublicDropoffLocations(near)
    return NextResponse.json({ data: { locations } }, { status: 200 })
  } catch (error) {
    console.error("GET /api/sell/dropoff-locations:", error)
    return NextResponse.json({ error: "Could not load dropoff locations" }, { status: 500 })
  }
}
