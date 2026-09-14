import { NextResponse } from "next/server"

import { backfillRecentLegacySupportCasesService } from "@/lib/services/supportCaseBackfillCron"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Copies recent contact_messages / order_support_requests into support_cases.
 * Inbox list is read-only — this is the write path.
 * Protected with CRON_SECRET.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await backfillRecentLegacySupportCasesService()
    return NextResponse.json({ summary, reference_time: new Date().toISOString() })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[cron] support-case-backfill failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
