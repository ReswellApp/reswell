import { NextResponse } from "next/server"
import { getLiveChatSupportTeamDisplayService } from "@/lib/services/liveChatSupportTeamDisplay"

export async function GET() {
  try {
    const team = await getLiveChatSupportTeamDisplayService()
    return NextResponse.json({ data: team }, { status: 200 })
  } catch (error) {
    console.error("GET /api/live-chat/support-team", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
