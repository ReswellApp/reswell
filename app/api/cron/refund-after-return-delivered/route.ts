import { NextResponse } from "next/server"
import { autoRefundAfterReturnDelivered } from "@/lib/services/autoRefundAfterReturnDelivered"

export const maxDuration = 60

/**
 * Every ~15 minutes: refund returned items 24h after ShipEngine reports return delivery.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const referenceTime = new Date()

  try {
    const summary = await autoRefundAfterReturnDelivered(referenceTime)
    return NextResponse.json({
      summary,
      reference_time: referenceTime.toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
