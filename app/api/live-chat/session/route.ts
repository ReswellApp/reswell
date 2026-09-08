import { NextRequest, NextResponse } from "next/server"
import { createOrResumeLiveChatSessionService } from "@/lib/services/liveChat"
import {
  consumeLiveChatRateLimit,
  liveChatClientIp,
  liveChatRateLimitResponse,
} from "@/lib/live-chat/rate-limit"

export async function POST(req: NextRequest) {
  try {
    const limit = consumeLiveChatRateLimit(`session:${liveChatClientIp(req)}`, 30, 10 * 60_000)
    if (!limit.ok) return liveChatRateLimitResponse(limit.retryAfterSec)

    const body: unknown = await req.json()
    const result = await createOrResumeLiveChatSessionService(body)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    console.error("POST /api/live-chat/session", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
