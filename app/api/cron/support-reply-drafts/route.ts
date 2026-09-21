import { NextResponse } from "next/server"

import { warmOpenSupportReplyDraftsService } from "@/lib/services/supportReplyDraft"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * Backup warmer for inbox drafts whose inbound after() was cut off.
 * Hourly — not every 10 minutes — so a missing harness column cannot
 * refill postgres_logs. Protected with CRON_SECRET.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await warmOpenSupportReplyDraftsService()
    return NextResponse.json({ summary, reference_time: new Date().toISOString() })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[cron] support-reply-drafts failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
