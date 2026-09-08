import { NextRequest, NextResponse } from "next/server"
import {
  getLiveChatVisitorThreadService,
  sendLiveChatVisitorMessageService,
} from "@/lib/services/liveChat"
import {
  consumeLiveChatRateLimit,
  liveChatClientIp,
  liveChatRateLimitResponse,
} from "@/lib/live-chat/rate-limit"
import { LIVE_CHAT_SESSION_CLOSED_CODE } from "@/lib/live-chat/errors"

type RouteContext = { params: Promise<{ publicId: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { publicId } = await context.params
    const visitorToken = req.headers.get("x-live-chat-visitor-token")?.trim()
    if (!visitorToken) {
      return NextResponse.json({ error: "Missing visitor token" }, { status: 401 })
    }

    const result = await getLiveChatVisitorThreadService(publicId, visitorToken)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }
    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    console.error("GET /api/live-chat/session/[publicId]/messages", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { publicId } = await context.params
    const limit = consumeLiveChatRateLimit(
      `msg:${liveChatClientIp(req)}:${publicId}`,
      40,
      60_000,
    )
    if (!limit.ok) return liveChatRateLimitResponse(limit.retryAfterSec)

    const body: unknown = await req.json()
    const result = await sendLiveChatVisitorMessageService(publicId, body)
    if ("error" in result) {
      const status = result.code === LIVE_CHAT_SESSION_CLOSED_CODE ? 409 : 400
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
