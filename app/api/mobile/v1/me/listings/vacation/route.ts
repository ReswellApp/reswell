import { mobileListingVacationBodySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { setMobileListingVacationService } from "@/lib/services/mobileMyListings"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const parsed = mobileListingVacationBodySchema.safeParse(await readMobileJson(request))
    if (!parsed.success) {
      return mobileDataResponse({ ok: false, status: 400, error: "Invalid vacation request" }, "private, no-store")
    }
    const result = await setMobileListingVacationService(session.supabase, session.user.id, {
      enabled: parsed.data.enabled,
      listingId: parsed.data.listing_id,
    })
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/listings/vacation", error, "Unable to update vacation right now")
  }
}
