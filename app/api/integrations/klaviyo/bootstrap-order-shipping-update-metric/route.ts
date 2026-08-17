import "@/lib/klaviyo/bootstrap-env"
import { bootstrapOrderShippingUpdateMetric } from "@/lib/klaviyo/bootstrap-order-shipping-update-metric"
import { NextResponse } from "next/server"

/**
 * One-time (or rare) call so **Order Shipping Update** event props (especially
 * `sms_milestone`) appear in Klaviyo flow trigger filters.
 *
 * Seeds three events: `out_for_delivery`, `delivered`, `exception`.
 *
 * `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { results } = await bootstrapOrderShippingUpdateMetric()
    const ok = results.every((r) => r.ok)

    return NextResponse.json({
      ok,
      message:
        "Seed events sent for sms_milestone = out_for_delivery | delivered | exception. Refresh the Order Shipping Update flow filter in Klaviyo (wait a minute if needed). Seed profile external_id: reswell-metric-seed-order-shipping-update — filter reswell_metric_seed ≠ true on live SMS if you want to ignore seeds.",
      results,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
