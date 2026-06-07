import { NextResponse } from "next/server"
import { runVercelErrorDigest } from "@/lib/services/vercelRequestLogMonitor"

/**
 * Daily scan of production Vercel request logs for user-impacting errors and warnings.
 * Emails admins via Klaviyo ("Platform Error Digest" metric) when issues are found.
 * Protected with CRON_SECRET (same pattern as other cron routes).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const rangeHours = Number(url.searchParams.get("hours") ?? "24")
  const safeHours =
    Number.isFinite(rangeHours) && rangeHours > 0 && rangeHours <= 168
      ? rangeHours
      : 24

  try {
    const summary = await runVercelErrorDigest(safeHours)
    return NextResponse.json({
      summary,
      reference_time: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] vercel-error-digest failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
