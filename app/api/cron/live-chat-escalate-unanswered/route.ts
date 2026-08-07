import { NextResponse } from "next/server"
import { escalateUnansweredLiveChatSessionsService } from "@/lib/services/liveChatEscalation"

export const maxDuration = 60

/**
 * Hourly: converts signed-in live chats with no agent reply for 24h into
 * support tickets (contact_messages) so they don't slip through the cracks.
 * Guest sessions stay in live chat only.
 *
 * Protected with CRON_SECRET (same pattern as other cron routes).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await escalateUnansweredLiveChatSessionsService()
    return NextResponse.json({
      ok: true,
      summary,
      reference_time: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] live-chat-escalate-unanswered failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
