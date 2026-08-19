import "@/lib/klaviyo/bootstrap-env"
import { bootstrapGiveawayMetrics } from "@/lib/klaviyo/bootstrap-giveaway-metrics"
import { NextResponse } from "next/server"

/**
 * One-time call so raffle metrics appear under Flows → Your metrics → API.
 * Klaviyo only surfaces custom API metrics after at least one accepted event.
 *
 * `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { results } = await bootstrapGiveawayMetrics()
    return NextResponse.json({
      ok: results.every((r) => r.ok || r.skipped),
      message:
        "Seed events sent. Open Klaviyo → Flows → Create flow → Metric — **Giveaway Entered**, **Giveaway Qualified**, and **Giveaway Listing Reminder** should appear under API within a few minutes. Seed events use profile external_id reswell-metric-seed-giveaway and property reswell_metric_seed — add a flow filter to ignore them.",
      results,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
