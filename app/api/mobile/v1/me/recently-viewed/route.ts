import { readMobileSession } from "@/lib/auth/mobile-session"
import { getMobileRecentlyViewedService } from "@/lib/services/mobileRecentlyViewed"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await getMobileRecentlyViewedService(session.supabase, session.user.id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure(
      "/api/mobile/v1/me/recently-viewed",
      error,
      "Unable to load recently viewed listings right now",
    )
  }
}
