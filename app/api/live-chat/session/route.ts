import { NextRequest, NextResponse } from "next/server"
import { createOrResumeLiveChatSessionService } from "@/lib/services/liveChat"

export async function POST(req: NextRequest) {
  try {
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
