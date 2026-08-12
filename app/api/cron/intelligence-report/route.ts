import { NextResponse } from "next/server"

import { runScheduledIntelligenceReports } from "@/lib/services/businessIntelligence"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * Daily (and weekly/monthly when due) Reswell Intelligence briefing.
 * Protected with CRON_SECRET.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await runScheduledIntelligenceReports()
    return NextResponse.json({ summary, reference_time: new Date().toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] intelligence-report failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
