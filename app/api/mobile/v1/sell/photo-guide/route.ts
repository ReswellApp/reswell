import { NextResponse } from "next/server"
import { getMobileSellPhotoGuide } from "@/lib/services/mobileSellPhotoGuide"
import { mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

/** GET `/api/mobile/v1/sell/photo-guide` — example shots for the sell photo guide. */
export async function GET() {
  try {
    return NextResponse.json(
      { data: getMobileSellPhotoGuide() },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
      },
    )
  } catch (error) {
    return mobileFailure("/api/mobile/v1/sell/photo-guide", error, "Unable to load the photo guide right now")
  }
}
