import { NextResponse } from "next/server"
import { listMobileSellDropoffLocations } from "@/lib/services/mobileSellDropoff"
import { mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

/** GET `/api/mobile/v1/sell/dropoff-locations` — cities where Reswell packs and ships a board. */
export async function GET() {
  try {
    const data = await listMobileSellDropoffLocations()
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
