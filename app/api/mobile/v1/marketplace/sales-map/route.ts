import { getMobileMarketplaceSalesMapService } from "@/lib/services/mobileMarketplaceSalesMap"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

/** Hourly ISR on the CDN; tag revalidation runs when orders complete. */
export const revalidate = 3600

export async function GET() {
  try {
    const result = await getMobileMarketplaceSalesMapService()
    return mobileDataResponse(result, "public, s-maxage=3600, stale-while-revalidate=7200")
  } catch (error) {
    return mobileFailure(
      "/api/mobile/v1/marketplace/sales-map",
      error,
      "Unable to load the sales map right now",
    )
  }
}
