import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { validateLiveChatSessionAccess } from "@/lib/services/liveChat"
import { assertLiveChatVisitorAccess } from "@/lib/services/liveChatVisitorAccess"
import {
  bootstrapLiveChatLabelUpdate,
  confirmLiveChatShipFromLabelUpdate,
} from "@/lib/services/liveChatShipFromLabelUpdate"
import { insertLiveChatMessage } from "@/lib/db/liveChat"
import { syncLiveChatAgentMessageToCase } from "@/lib/services/liveChatSupportCase"
import { broadcastLiveChatMessage } from "@/lib/services/liveChatRealtime"
import {
  consumeLiveChatRateLimit,
  LIVE_CHAT_RATE_LIMITS,
  liveChatClientIp,
  liveChatRateLimitResponse,
} from "@/lib/live-chat/rate-limit"
import { liveChatLabelUpdateConfirmSchema } from "@/lib/validations/liveChatLabelUpdate"
import { LIVE_CHAT_TEAM_NAME } from "@/lib/live-chat/widget-config"

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

/** Eligible unscanned sales + saved ship-from addresses for the signed-in seller. */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { publicId } = await context.params
    const visitorToken = req.nextUrl.searchParams.get("visitor_token")?.trim() || undefined
    const limit = consumeLiveChatRateLimit(
      `label-update-get:${liveChatClientIp(req)}:${publicId}`,
      LIVE_CHAT_RATE_LIMITS.actionsGet.limit,
      LIVE_CHAT_RATE_LIMITS.actionsGet.windowMs,
    )
    if (!limit.ok) return liveChatRateLimitResponse(limit.retryAfterSec)

    const loaded = await loadVisitorSession(publicId, visitorToken)
    if ("error" in loaded) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status })
    }

    const svc = createServiceRoleClient()
    const data = await bootstrapLiveChatLabelUpdate({ svc, session: loaded.session })
    return NextResponse.json({ data })
  } catch (error) {
    console.error("GET /api/live-chat/session/[publicId]/label-update", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

/** Confirm a ship-from-only label reprint for one eligible sale. */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { publicId } = await context.params
    const body: unknown = await req.json()
    const parsed = liveChatLabelUpdateConfirmSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid label update payload" }, { status: 400 })
    }

    const limit = consumeLiveChatRateLimit(
      `label-update-post:${liveChatClientIp(req)}:${publicId}`,
      LIVE_CHAT_RATE_LIMITS.actionsPost.limit,
      LIVE_CHAT_RATE_LIMITS.actionsPost.windowMs,
    )
    if (!limit.ok) return liveChatRateLimitResponse(limit.retryAfterSec)

    const loaded = await loadVisitorSession(publicId, parsed.data.visitor_token)
    if ("error" in loaded) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status })
    }

    const svc = createServiceRoleClient()
    const result = await confirmLiveChatShipFromLabelUpdate({
      svc,
      session: loaded.session,
      orderId: parsed.data.order_id,
      shipFromAddressId: parsed.data.ship_from_address_id,
      reason: parsed.data.reason,
      reasonNote: parsed.data.reason_note,
    })

    if (!result.ok) {
      const status =
        result.code === "auth_required" ? 401 : result.code === "forbidden" ? 403 : 400
      return NextResponse.json(
        { error: result.error, code: result.code ?? null },
        { status },
      )
    }

    const note = await insertLiveChatMessage(svc, {
      session_id: loaded.session.id,
      sender_type: "agent",
      content: result.message,
    })
    if (note) {
      await syncLiveChatAgentMessageToCase(svc, loaded.session, note.content)
      void broadcastLiveChatMessage({
        sessionId: loaded.session.id,
        message: {
          id: note.id,
          session_id: loaded.session.id,
          sender_type: "agent",
          sender_agent_id: null,
          content: note.content,
          created_at: note.created_at,
          agent_display_name: LIVE_CHAT_TEAM_NAME,
        },
      })
    }

    return NextResponse.json({
      data: {
        message: result.message,
        trackingNumber: result.trackingNumber,
        orderNum: result.orderNum,
      },
    })
  } catch (error) {
    console.error("POST /api/live-chat/session/[publicId]/label-update", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
