import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { validateLiveChatSessionAccess } from "@/lib/services/liveChat"
import { assertLiveChatVisitorAccess } from "@/lib/services/liveChatVisitorAccess"
import { listLiveChatVisitorOrderTiles } from "@/lib/services/liveChatVisitorOrders"
import {
  consumeLiveChatRateLimit,
  LIVE_CHAT_RATE_LIMITS,
  liveChatClientIp,
  liveChatRateLimitResponse,
} from "@/lib/live-chat/rate-limit"
import { liveChatVisitorOrdersQuerySchema } from "@/lib/validations/liveChatVisitorOrders"

type RouteContext = { params: Promise<{ publicId: string }> }

async function loadVisitorSession(publicId: string, visitorToken?: string) {
  const access = await assertLiveChatVisitorAccess()
  if (!access.ok) {
    return { error: access.error, status: access.status }
  }
  if (!visitorToken) {
    return { error: "Missing visitor token", status: 401 as const }
  }
  const session = await validateLiveChatSessionAccess(publicId, visitorToken)
  if (!session) return { error: "Session not found", status: 404 as const }
  return { session }
}

/** Recent purchases and sales for tap-to-pick order tiles. */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { publicId } = await context.params
    const parsed = liveChatVisitorOrdersQuerySchema.safeParse({
      visitor_token: req.nextUrl.searchParams.get("visitor_token")?.trim() || undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const limit = consumeLiveChatRateLimit(
      `orders-get:${liveChatClientIp(req)}:${publicId}`,
      LIVE_CHAT_RATE_LIMITS.actionsGet.limit,
      LIVE_CHAT_RATE_LIMITS.actionsGet.windowMs,
    )
    if (!limit.ok) return liveChatRateLimitResponse(limit.retryAfterSec)

    const loaded = await loadVisitorSession(publicId, parsed.data.visitor_token)
    if ("error" in loaded) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status })
    }

    const svc = createServiceRoleClient()
    const data = await listLiveChatVisitorOrderTiles({ svc, session: loaded.session })
    return NextResponse.json({ data })
  } catch (error) {
    console.error("GET /api/live-chat/session/[publicId]/orders", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
