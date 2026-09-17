import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { getLiveChatSessionByPublicId } from "@/lib/db/liveChat"
import { validateLiveChatSessionAccess } from "@/lib/services/liveChat"
import { assertLiveChatVisitorAccess } from "@/lib/services/liveChatVisitorAccess"
import { getLiveChatStaffProfileService } from "@/lib/services/liveChatAdmin"
import {
  decideLiveChatShippingAction,
  listLiveChatPendingShippingActions,
  resolveLiveChatActionActor,
} from "@/lib/services/liveChatShippingActions"
import { broadcastLiveChatMessage } from "@/lib/services/liveChatRealtime"
import { insertLiveChatMessage } from "@/lib/db/liveChat"
import { syncLiveChatAgentMessageToCase } from "@/lib/services/liveChatSupportCase"
import {
  consumeLiveChatRateLimit,
  LIVE_CHAT_RATE_LIMITS,
  liveChatClientIp,
  liveChatRateLimitResponse,
} from "@/lib/live-chat/rate-limit"
import { liveChatConfirmActionSchema } from "@/lib/validations/liveChatActions"
import { LIVE_CHAT_TEAM_NAME } from "@/lib/live-chat/widget-config"

type RouteContext = { params: Promise<{ publicId: string }> }

async function loadSessionForActor(publicId: string, visitorToken?: string) {
  const staff = await getLiveChatStaffProfileService()
  if ("success" in staff && staff.success) {
    const supabase = await createClient()
    const session = await getLiveChatSessionByPublicId(supabase, publicId)
    if (!session) return { error: "Session not found", status: 404 as const }
    return { session, staffUserId: staff.userId, visitorToken: null as string | null }
  }

  const access = await assertLiveChatVisitorAccess()
  if (!access.ok) {
    return { error: access.error, status: access.status }
  }
  if (!visitorToken) {
    return { error: "Missing visitor token", status: 401 as const }
  }
  const session = await validateLiveChatSessionAccess(publicId, visitorToken)
  if (!session) return { error: "Session not found", status: 404 as const }
  return { session, staffUserId: null as string | null, visitorToken }
}

/** Pending confirm-gated shipping actions for this chat. */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { publicId } = await context.params
    const visitorToken = req.nextUrl.searchParams.get("visitor_token")?.trim() || undefined
    const limit = consumeLiveChatRateLimit(
      `actions-get:${liveChatClientIp(req)}:${publicId}`,
      LIVE_CHAT_RATE_LIMITS.actionsGet.limit,
      LIVE_CHAT_RATE_LIMITS.actionsGet.windowMs,
    )
    if (!limit.ok) return liveChatRateLimitResponse(limit.retryAfterSec)

    const loaded = await loadSessionForActor(publicId, visitorToken)
    if ("error" in loaded) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status })
    }

    return NextResponse.json({
      data: { actions: listLiveChatPendingShippingActions(loaded.session) },
    })
  } catch (error) {
    console.error("GET /api/live-chat/session/[publicId]/actions", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

/** Confirm or cancel a pending shipping action. Never executes without this step. */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { publicId } = await context.params
    const body: unknown = await req.json()
    const parsed = liveChatConfirmActionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid action payload" }, { status: 400 })
    }

    const limit = consumeLiveChatRateLimit(
      `actions-post:${liveChatClientIp(req)}:${publicId}`,
      LIVE_CHAT_RATE_LIMITS.actionsPost.limit,
      LIVE_CHAT_RATE_LIMITS.actionsPost.windowMs,
    )
    if (!limit.ok) return liveChatRateLimitResponse(limit.retryAfterSec)

    const loaded = await loadSessionForActor(publicId, parsed.data.visitor_token)
    if ("error" in loaded) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status })
    }

    const svc = createServiceRoleClient()
    const actor = await resolveLiveChatActionActor(svc, {
      visitorUserId: loaded.session.user_id,
      staffUserId: loaded.staffUserId,
    })

    const decided = await decideLiveChatShippingAction({
      svc,
      session: loaded.session,
      actor,
      actionId: parsed.data.action_id,
      decision: parsed.data.decision,
      staffUserId: loaded.staffUserId,
    })

    if (!decided.ok) {
      const status =
        decided.code === "auth_required" ? 401 : decided.code === "forbidden" ? 403 : 400
      return NextResponse.json(
        { error: decided.error, code: decided.code ?? null },
        { status },
      )
    }

    if (parsed.data.decision === "confirm" && decided.action.status === "confirmed") {
      const note = await insertLiveChatMessage(svc, {
        session_id: loaded.session.id,
        sender_type: "agent",
        content: decided.message,
      })
      if (note) {
        await syncLiveChatAgentMessageToCase(svc, decided.session, note.content)
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
    }

    return NextResponse.json({
      data: {
        action: decided.action,
        message: decided.message,
        actions: listLiveChatPendingShippingActions(decided.session),
      },
    })
  } catch (error) {
    console.error("POST /api/live-chat/session/[publicId]/actions", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
