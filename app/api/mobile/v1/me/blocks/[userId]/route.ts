import { z } from "zod"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { unblockUserService } from "@/lib/services/userBlocks"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ userId: string }> }

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const { userId } = await context.params
    const parsed = z.string().uuid().safeParse(userId)
    if (!parsed.success) {
      return mobileDataResponse({ ok: false, status: 400, error: "Invalid member." }, "private, no-store")
    }
    const result = await unblockUserService(session.supabase, session.user, parsed.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/blocks/[userId]", error, "Couldn't unblock that member.")
  }
}
