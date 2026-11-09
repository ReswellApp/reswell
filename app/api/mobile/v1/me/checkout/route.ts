import { readMobileSession } from "@/lib/auth/mobile-session"
import { getMobileCheckoutConfigService } from "@/lib/services/mobileCheckout"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    return mobileDataResponse(getMobileCheckoutConfigService(), "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/checkout", error, "Unable to start checkout right now")
  }
}
