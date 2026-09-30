import { NextResponse } from "next/server"

import { isAdminAnalyticsRawPruningEnabled } from "@/lib/analytics/admin-rollup-policy"
import { runAdminAnalyticsRollups } from "@/lib/services/adminAnalyticsRollups"
import { isCronRequestAuthorized } from "@/lib/utils/cron-auth"

export const maxDuration = 300

/**
 * Incrementally builds daily admin analytics rollups. Raw retention is disabled
 * by default and must only be enabled after backfill and parity validation.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret?.trim()) {
    return NextResponse.json({ error: "Cron authentication is not configured" }, { status: 503 })
  }
  if (!isCronRequestAuthorized(request, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await runAdminAnalyticsRollups(new Date(), {
      pruneRaw: isAdminAnalyticsRawPruningEnabled(
        process.env.ADMIN_ANALYTICS_RAW_PRUNING_ENABLED,
      ),
    })
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
