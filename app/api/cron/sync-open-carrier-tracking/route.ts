import { NextResponse } from "next/server"
import { syncOpenShippingCarrierTracking } from "@/lib/services/syncOpenShippingCarrierTracking"

export const maxDuration = 60

/**
 * Every 15 minutes: poll ShipEngine for open shipping orders missing carrier_delivered_at.
 * Ensures delivery status (and the 24h pending-earnings clock) updates even if webhooks miss.
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
    const summary = await syncOpenShippingCarrierTracking()
    return NextResponse.json({
      summary,
      reference_time: referenceTime.toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
