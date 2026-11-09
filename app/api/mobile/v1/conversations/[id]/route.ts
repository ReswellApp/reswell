import { NextRequest } from "next/server"
import { mobileConversationParamSchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { getMobileConversationService } from "@/lib/services/mobileAccountApi"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")

    const { id } = await context.params
    const parsed = mobileConversationParamSchema.safeParse({ id })
    if (!parsed.success) {
      return mobileDataResponse({ ok: false, status: 400, error: "Invalid conversation" }, "no-store")
    }

    const result = await getMobileConversationService(session.supabase, session.user.id, parsed.data.id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/conversations/[id]", error, "Unable to load messages right now")
  }
}
