import { NextRequest, NextResponse } from "next/server"

/** after() runs Jev + first writer + optional Pro retry + persist. 60s can kill persist. */
export const maxDuration = 120
import {
  getLiveChatVisitorThreadService,
  sendLiveChatVisitorMessageService,
} from "@/lib/services/liveChat"
import { assertLiveChatVisitorAccess } from "@/lib/services/liveChatVisitorAccess"
import { assertHumanRequest } from "@/lib/services/botProtection"
import {
  consumeLiveChatRateLimit,
  LIVE_CHAT_RATE_LIMITS,
  liveChatClientIp,
  liveChatRateLimitResponse,
} from "@/lib/live-chat/rate-limit"
import {
  LIVE_CHAT_SESSION_CLOSED_CODE,
  LIVE_CHAT_SESSION_MISSING_CODE,
} from "@/lib/live-chat/errors"

type RouteContext = { params: Promise<{ publicId: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const access = await assertLiveChatVisitorAccess()
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const { publicId } = await context.params
    const visitorToken = req.headers.get("x-live-chat-visitor-token")?.trim()
    if (!visitorToken) {
      return NextResponse.json({ error: "Missing visitor token" }, { status: 401 })
    }

    const result = await getLiveChatVisitorThreadService(publicId, visitorToken)
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status ?? 404 },
      )
    }
    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    console.error("GET /api/live-chat/session/[publicId]/messages", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const human = await assertHumanRequest()
    if (!human.ok) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { publicId } = await context.params
    const limit = consumeLiveChatRateLimit(
      `msg:${liveChatClientIp(req)}:${publicId}`,
      LIVE_CHAT_RATE_LIMITS.message.limit,
      LIVE_CHAT_RATE_LIMITS.message.windowMs,
    )
    if (!limit.ok) return liveChatRateLimitResponse(limit.retryAfterSec)

    const body: unknown = await req.json()
    const result = await sendLiveChatVisitorMessageService(publicId, body)
    if ("error" in result) {
      const status =
        result.status ??
        (result.code === LIVE_CHAT_SESSION_CLOSED_CODE
          ? 409
          : result.code === LIVE_CHAT_SESSION_MISSING_CODE
            ? 404
            : 400)
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status },
      )
    }
    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    console.error("POST /api/live-chat/session/[publicId]/messages", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
