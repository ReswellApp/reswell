import { getMobileBrowseRailService } from "@/lib/services/mobileBrowseRail"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const result = getMobileBrowseRailService()
    return mobileDataResponse(result, "public, s-maxage=300, stale-while-revalidate=600")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/browse-rail", error, "Unable to load categories right now")
  }
}
