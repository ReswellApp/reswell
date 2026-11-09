import { z } from "zod"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { endMobileListingService } from "@/lib/services/mobileMyListings"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const { id } = await context.params
    const parsed = z.string().uuid().safeParse(id)
    if (!parsed.success) {
      return mobileDataResponse({ ok: false, status: 400, error: "Invalid listing" }, "private, no-store")
    }
    const result = await endMobileListingService(session.supabase, session.user.id, parsed.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/listings/[id]/end", error, "Unable to delete listing right now")
  }
}
