import { NextRequest } from "next/server"
import { getMobileShippingZip } from "@/lib/services/mobileShippingEstimate"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const zip = request.nextUrl.searchParams.get("zip")?.trim() ?? ""
    const result = await getMobileShippingZip(zip)
    return mobileDataResponse(result, "public, max-age=300, s-maxage=600")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/shipping/zip", error, "Unable to look up that ZIP right now")
  }
}
