import { NextRequest, NextResponse } from "next/server"
import { liveChatAiService } from "@/lib/services/liveChatAi"

type RouteContext = { params: Promise<{ publicId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { publicId } = await context.params
    const body: unknown = await req.json()
    const result = await liveChatAiService(publicId, body)
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 400 },
      )
    }
    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    console.error("POST /api/live-chat/session/[publicId]/ai", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
