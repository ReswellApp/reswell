import { NextResponse } from "next/server"
import {
  escalateUnansweredLiveChatSessionsService,
  resolveInactiveLiveChatSessionsService,
} from "@/lib/services/liveChatEscalation"

export const maxDuration = 60

/**
 * Hourly: converts signed-in live chats with no agent reply for 24h into
 * support tickets (contact_messages) so they don't slip through the cracks,
 * and resolves chats that have been completely silent for 7 days.
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
    const escalation = await escalateUnansweredLiveChatSessionsService()
    const inactivity = await resolveInactiveLiveChatSessionsService()
    return NextResponse.json({
      ok: true,
      summary: { escalation, inactivity },
      reference_time: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] live-chat-escalate-unanswered failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
