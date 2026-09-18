import { NextRequest, NextResponse } from "next/server"
import { createOrResumeLiveChatSessionService } from "@/lib/services/liveChat"
import { assertHumanRequest } from "@/lib/services/botProtection"
import {
  consumeLiveChatRateLimit,
  LIVE_CHAT_RATE_LIMITS,
  liveChatClientIp,
  liveChatRateLimitResponse,
} from "@/lib/live-chat/rate-limit"

export async function POST(req: NextRequest) {
  try {
    const human = await assertHumanRequest()
    if (!human.ok) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const limit = consumeLiveChatRateLimit(
      `session:${liveChatClientIp(req)}`,
      LIVE_CHAT_RATE_LIMITS.sessionCreate.limit,
      LIVE_CHAT_RATE_LIMITS.sessionCreate.windowMs,
    )
    if (!limit.ok) return liveChatRateLimitResponse(limit.retryAfterSec)

    const body: unknown = await req.json()
    const result = await createOrResumeLiveChatSessionService(body)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 })
    }
    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    console.error("POST /api/live-chat/session", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
