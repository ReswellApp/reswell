import { NextResponse } from "next/server"
import { syncOpenReturnCarrierTracking } from "@/lib/services/syncOpenReturnCarrierTracking"

export const maxDuration = 60

/**
 * Every 15 minutes: poll ShipEngine for open return shipments missing carrier_delivered_at.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await syncOpenReturnCarrierTracking()
    return NextResponse.json({ summary })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
