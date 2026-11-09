import "@/lib/klaviyo/bootstrap-env"
import { bootstrapEarningsAvailableMetric } from "@/lib/klaviyo/bootstrap-earnings-available-metric"
import { NextResponse } from "next/server"

/**
 * One-time call so **Earnings Available** appears under
 * Flows → Create flow → Metric. Klaviyo only surfaces custom API metrics after
 * at least one accepted Events API event per metric name.
 *
 * `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { result } = await bootstrapEarningsAvailableMetric()
    return NextResponse.json({
      ok: result.ok,
      message:
        "Seed event sent. Open Klaviyo → Flows → Create flow → Metric — **Earnings Available** should appear under API within a few minutes. Filter seed events where reswell_metric_seed is not true.",
      result,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
