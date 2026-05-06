import "@/lib/klaviyo/bootstrap-env"
import { bootstrapInactiveMilestoneMetrics } from "@/lib/klaviyo/bootstrap-inactive-milestone-metrics"
import { NextResponse } from "next/server"

/**
 * One-time (or rare) call so **User Inactive 3 / 15 / 30 Days** appear under
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
    const { results } = await bootstrapInactiveMilestoneMetrics()
    const accepted = results.every((r) => r.ok)

    return NextResponse.json({
      ok: accepted,
      message:
        "Seed events sent. Open Klaviyo → Flows → Create flow → Metric — the three “User Inactive …” metrics should appear under API within a few minutes. Seed events use profile external_id reswell-metric-seed-inactive and property reswell_metric_seed — add a flow filter to ignore them if needed.",
      results,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
