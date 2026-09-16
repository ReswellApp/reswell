import { NextRequest, NextResponse } from "next/server"
import { getLiveChatSessionByPublicId } from "@/lib/db/liveChat"
import { validateLiveChatSessionAccess } from "@/lib/services/liveChat"
import { getLiveChatStaffProfileService } from "@/lib/services/liveChatAdmin"
import { broadcastLiveChatTyping } from "@/lib/services/liveChatRealtime"
import { liveChatTypingSchema } from "@/lib/validations/liveChat"
import { createClient } from "@/lib/supabase/server"
import {
  consumeLiveChatRateLimit,
  liveChatClientIp,
  liveChatRateLimitResponse,
} from "@/lib/live-chat/rate-limit"

type RouteContext = { params: Promise<{ publicId: string }> }

/** Validates the publisher, then fans typing out from the server. Never returns session UUIDs. */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { publicId } = await context.params
    const body: unknown = await req.json()
    const parsed = liveChatTypingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid typing payload" }, { status: 400 })
    }

    const limit = consumeLiveChatRateLimit(
      `typing:${liveChatClientIp(req)}:${parsed.data.visitor_token ?? "staff"}`,
      40,
      60_000,
    )
    if (!limit.ok) return liveChatRateLimitResponse(limit.retryAfterSec)

    if (parsed.data.participant_type === "visitor") {
      if (!parsed.data.visitor_token) {
        return NextResponse.json({ error: "Missing visitor token" }, { status: 401 })
      }
      const session = await validateLiveChatSessionAccess(publicId, parsed.data.visitor_token)
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }
      await broadcastLiveChatTyping({
        sessionId: session.id,
        participantType: "visitor",
        displayName: parsed.data.display_name,
        isTyping: parsed.data.is_typing,
      })
      return NextResponse.json({ data: { ok: true } }, { status: 200 })
    }

    const staff = await getLiveChatStaffProfileService()
    if ("error" in staff) {
      return NextResponse.json({ error: staff.error }, { status: 403 })
    }

    const supabase = await createClient()
    const session = await getLiveChatSessionByPublicId(supabase, publicId)
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    await broadcastLiveChatTyping({
      sessionId: session.id,
      participantType: "agent",
      displayName: staff.displayName,
      isTyping: parsed.data.is_typing,
    })
    return NextResponse.json({ data: { ok: true } }, { status: 200 })
  } catch (error) {
    console.error("POST /api/live-chat/session/[publicId]/typing", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
