import { NextRequest, NextResponse } from "next/server"
import { parseDropoffNearbyOrigin } from "@/lib/dropoff-location-nearby"
import { listMobileSellDropoffLocations } from "@/lib/services/mobileSellDropoff"
import { mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

/**
 * GET `/api/mobile/v1/sell/dropoff-locations`
 * Same nearby-ZIP rule as website `/sell`: pass listing `lat`/`lng` or receive no cities.
 */
export async function GET(req: NextRequest) {
  try {
    const near = parseDropoffNearbyOrigin(
      req.nextUrl.searchParams.get("lat"),
      req.nextUrl.searchParams.get("lng"),
    )
    const data = await listMobileSellDropoffLocations(
      {
        boardLength: req.nextUrl.searchParams.get("board_length") ?? "",
        boardWidthInches: req.nextUrl.searchParams.get("board_width") ?? "",
      },
      near,
    )
    return NextResponse.json(
      { data },
      { status: 200, headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    )
  } catch (error) {
    return mobileFailure(
      "/api/mobile/v1/sell/dropoff-locations",
      error,
      "Could not load drop-off cities right now",
    )
  }
}
