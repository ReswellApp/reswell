import { listMobileBrandsService } from "@/lib/services/mobileBrands"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const result = await listMobileBrandsService()
    return mobileDataResponse(result, "public, s-maxage=300, stale-while-revalidate=86400")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/brands", error, "Unable to load brands right now")
  }
}
