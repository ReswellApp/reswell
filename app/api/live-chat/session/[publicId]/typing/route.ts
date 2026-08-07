import { NextRequest, NextResponse } from "next/server"
import { getLiveChatSessionIdByPublicId, validateLiveChatSessionAccess } from "@/lib/services/liveChat"
import { liveChatTypingSchema } from "@/lib/validations/liveChat"

type RouteContext = { params: Promise<{ publicId: string }> }

/** Validates visitor typing requests; actual broadcast happens client-side on the session channel. */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { publicId } = await context.params
    const body: unknown = await req.json()
    const parsed = liveChatTypingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid typing payload" }, { status: 400 })
    }

    if (parsed.data.participant_type === "visitor") {
      if (!parsed.data.visitor_token) {
        return NextResponse.json({ error: "Missing visitor token" }, { status: 401 })
      }
      const session = await validateLiveChatSessionAccess(publicId, parsed.data.visitor_token)
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }
      return NextResponse.json({ data: { session_id: session.id } }, { status: 200 })
    }

    const sessionId = await getLiveChatSessionIdByPublicId(publicId)
    if (!sessionId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }
    return NextResponse.json({ data: { session_id: sessionId } }, { status: 200 })
  } catch (error) {
    console.error("POST /api/live-chat/session/[publicId]/typing", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
