import { NextResponse } from "next/server"
import { getMobileBrowseRail } from "@/lib/services/mobileBrowseRail"
import { mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json(
      { data: getMobileBrowseRail() },
      {
        status: 200,
        headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120" },
      },
    )
  } catch (error) {
    return mobileFailure("/api/mobile/v1/browse-rail", error, "Unable to load browse links right now")
  }
}
