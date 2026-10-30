import { NextRequest } from "next/server"
import { getMobileHelpHub } from "@/lib/services/mobileHelp"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? ""
    return mobileDataResponse(
      { ok: true, data: getMobileHelpHub(query) },
      "public, max-age=60, s-maxage=120, stale-while-revalidate=300",
    )
  } catch (error) {
    return mobileFailure("/api/mobile/v1/help", error, "Unable to load help right now")
  }
}
