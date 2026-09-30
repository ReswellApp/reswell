import { NextResponse } from "next/server"

import { syncKlaviyoFlowPerformance, KlaviyoFlowStatsError } from "@/lib/services/klaviyoFlowStats"

export const maxDuration = 120

/**
 * Daily snapshot of Klaviyo flow delivery stats and recent metric ingest counts.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await syncKlaviyoFlowPerformance({
      metricCounts: true,
    })
    return NextResponse.json(summary)
  } catch (e) {
    if (e instanceof KlaviyoFlowStatsError) {
      const status = e.missingKey ? 503 : e.status === 401 || e.status === 403 ? 502 : 500
      return NextResponse.json({ error: e.message }, { status })
    }
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron/klaviyo-flow-stats]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
