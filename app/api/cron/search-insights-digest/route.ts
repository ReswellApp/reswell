import { NextResponse } from "next/server"
import { runSearchInsightsDigest } from "@/lib/services/searchInsightsDigest"

/**
 * Weekly digest of pressing search insights (critical + warning) emailed to the
 * team via Klaviyo, so they act without opening the dashboard.
 * Protected with CRON_SECRET (same pattern as other cron routes).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await runSearchInsightsDigest(7)
    return NextResponse.json({ summary, reference_time: new Date().toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] search-insights-digest failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
