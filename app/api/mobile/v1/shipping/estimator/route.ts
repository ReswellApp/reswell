import { getMobileShippingEstimator } from "@/lib/services/mobileShippingEstimate"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return mobileDataResponse(
      { ok: true, data: getMobileShippingEstimator() },
      "public, max-age=60, s-maxage=120, stale-while-revalidate=300",
    )
  } catch (error) {
    return mobileFailure("/api/mobile/v1/shipping/estimator", error, "Unable to load the estimator right now")
  }
}
