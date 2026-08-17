import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { bootstrapOrderShippingUpdateMetric } from "@/lib/klaviyo/bootstrap-order-shipping-update-metric"

/**
 * Admin session: seed **Order Shipping Update** `sms_milestone` props in Klaviyo
 * for flow trigger filters. Same seeds as the CRON_SECRET integrations bootstrap.
 */
export async function POST() {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  try {
    const { results } = await bootstrapOrderShippingUpdateMetric()
    const ok = results.every((r) => r.ok)

    return NextResponse.json({
      ok,
      message:
        "Seed events sent for sms_milestone = out_for_delivery | delivered | exception. Refresh the Order Shipping Update flow filter in Klaviyo.",
      results,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
