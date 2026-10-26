import { mobileListingRelistBodySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { relistMobileListingService } from "@/lib/services/mobileMyListings"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const parsed = mobileListingRelistBodySchema.safeParse(await readMobileJson(request))
    if (!parsed.success) {
      return mobileDataResponse({ ok: false, status: 400, error: "Invalid listing" }, "private, no-store")
    }
    const result = await relistMobileListingService(session.supabase, session.user.id, parsed.data.listing_id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/listings/relist", error, "Unable to relist right now")
  }
}
