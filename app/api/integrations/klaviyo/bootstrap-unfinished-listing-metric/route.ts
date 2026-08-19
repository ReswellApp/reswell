import "@/lib/klaviyo/bootstrap-env"
import { bootstrapUnfinishedListingMetric } from "@/lib/klaviyo/bootstrap-unfinished-listing-metric"
import { NextResponse } from "next/server"

/**
 * One-time call so **Unfinished Listing** appears under
 * Flows → Your metrics → API. Klaviyo only surfaces custom API metrics after
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
    const { result } = await bootstrapUnfinishedListingMetric()
    return NextResponse.json({
      ok: result.ok,
      message:
        "Seed event sent. Open Klaviyo → Flows → Create flow → Metric — **Unfinished Listing** should appear under API within a few minutes. Seed events use profile external_id reswell-metric-seed-unfinished-listing and property reswell_metric_seed — add a flow filter to ignore them.",
      result,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
