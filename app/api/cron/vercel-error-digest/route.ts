import { NextResponse } from "next/server"
import { runVercelErrorDigest } from "@/lib/services/vercelErrorDigest"

/**
 * Daily digest of Vercel production errors (critical + warning) emailed to the
 * team via Klaviyo. Protected with CRON_SECRET (same pattern as other cron routes).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await runVercelErrorDigest(24)
    return NextResponse.json({
      summary: {
        sent: summary.sent,
        skipped: summary.skipped,
        recipients: summary.recipients,
        critical_count: summary.criticalCount,
        warning_count: summary.warningCount,
        range_hours: summary.rangeHours,
        deployments_scanned: summary.scan.deploymentsScanned,
        issue_count: summary.scan.issues.length,
        skipped_reason: summary.scan.skippedReason ?? null,
      },
      reference_time: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] vercel-error-digest failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
