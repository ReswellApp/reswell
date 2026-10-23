import { getMobileHomeService } from "@/lib/services/mobileHome"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const result = await getMobileHomeService()
    return mobileDataResponse(result, "public, s-maxage=60, stale-while-revalidate=300")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/home", error, "Unable to load the homepage right now")
  }
}
