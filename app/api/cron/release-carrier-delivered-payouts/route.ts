import { NextResponse } from "next/server"
import { autoReleaseShippingPayoutsAfterCarrierDelivery } from "@/lib/services/autoReleaseShippingPayoutsAfterCarrierDelivery"

/**
 * Hourly job: release seller wallet earnings 24h after ShipEngine reports delivery.
 * Protected with CRON_SECRET (same pattern as other cron routes).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const referenceTime = new Date()

  try {
    const summary = await autoReleaseShippingPayoutsAfterCarrierDelivery(referenceTime)
    return NextResponse.json({
      summary,
      reference_time: referenceTime.toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
