import { mobileBlockBodySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { blockUserService, listBlockedUsersService } from "@/lib/services/userBlocks"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await listBlockedUsersService(session.supabase, session.user.id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/blocks", error, "Unable to load blocked members.")
  }
}

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const parsed = mobileBlockBodySchema.safeParse(await readMobileJson(request))
    if (!parsed.success) {
      return mobileDataResponse({ ok: false, status: 400, error: "Pick a member to block." }, "private, no-store")
    }
    const result = await blockUserService(session.supabase, session.user, parsed.data.user_id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/blocks", error, "Couldn't block that member.")
  }
}
