import { NextRequest, NextResponse } from "next/server"
import { liveChatAiService } from "@/lib/services/liveChatAi"
import {
  consumeLiveChatRateLimit,
  liveChatClientIp,
  liveChatRateLimitResponse,
} from "@/lib/live-chat/rate-limit"

type RouteContext = { params: Promise<{ publicId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { publicId } = await context.params
    const ip = liveChatClientIp(req)
    const perToken = consumeLiveChatRateLimit(`ai:${ip}:${publicId}`, 12, 60_000)
    if (!perToken.ok) return liveChatRateLimitResponse(perToken.retryAfterSec)
    const perIp = consumeLiveChatRateLimit(`ai-ip:${ip}`, 20, 10 * 60_000)
    if (!perIp.ok) return liveChatRateLimitResponse(perIp.retryAfterSec)

    const body: unknown = await req.json()
    const result = await liveChatAiService(publicId, body)
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error, code: "code" in result ? result.code : undefined },
        { status: result.status ?? 400 },
      )
    }
    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    console.error("POST /api/live-chat/session/[publicId]/ai", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
