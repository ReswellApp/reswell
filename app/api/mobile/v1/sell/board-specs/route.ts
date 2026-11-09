import { NextResponse } from "next/server"
import { getMobileSellBoardSpecs } from "@/lib/services/mobileSellBoardSpecs"
import { mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

/** GET `/api/mobile/v1/sell/board-specs` — surfboard dimensions and fins from the website sell flow. */
export async function GET() {
  try {
    return NextResponse.json(
      { data: getMobileSellBoardSpecs() },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" },
      },
    )
  } catch (error) {
    return mobileFailure("/api/mobile/v1/sell/board-specs", error, "Unable to load board details right now")
  }
}
