import { readMobileSession } from "@/lib/auth/mobile-session"
import { quoteMobileCheckoutService } from "@/lib/services/mobileCheckout"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await quoteMobileCheckoutService(session.supabase, session.user, await readMobileJson(request))
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/checkout/quote", error, "Unable to quote shipping right now")
  }
}
