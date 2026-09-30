import { NextResponse } from "next/server"

import { runAdminAnalyticsRollups } from "@/lib/services/adminAnalyticsRollups"

export const maxDuration = 300

/**
 * Incrementally builds daily admin analytics rollups and coverage-gated raw
 * retention. The frequent schedule accelerates historical catch-up; once caught
 * up, only the first run after a completed UTC day performs rollup work.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await runAdminAnalyticsRollups()
    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[cron/admin-analytics-rollups]", message)
    return NextResponse.json(
      { error: "Admin analytics rollup failed" },
      { status: 500 },
    )
  }
}
