import "@/lib/klaviyo/bootstrap-env"
import { bootstrapSellerMessageReminderMetrics } from "@/lib/klaviyo/bootstrap-seller-message-reminder-metrics"
import { NextResponse } from "next/server"

/**
 * One-time call so **Seller Still Here** and **Seller Listing Hide Warning** appear under
 * Flows → Your metrics → API. Klaviyo only surfaces custom API metrics after at least one
 * accepted Events API event per metric name.
 *
 * `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { results } = await bootstrapSellerMessageReminderMetrics()
    const ok = results.every((result) => result.ok || result.skipped)

    return NextResponse.json({
      ok,
      message:
        "Seed events sent. Open Klaviyo → Flows → Create flow → Metric — **Seller Still Here** (day 3) and **Seller Listing Hide Warning** (day 6) should appear under API within a few minutes. Seed events use profile external_id reswell-metric-seed-seller-message-reminder and property reswell_metric_seed — add a flow filter to ignore them.",
      results,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
