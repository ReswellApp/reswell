import { NextResponse } from "next/server"
import { runShipEngineAdjustmentCron } from "@/lib/services/runShipEngineAdjustmentCron"

export const maxDuration = 60

/**
 * Daily: ingest ShipEngine nightly post-shipment adjustment reports.
 * Protected with CRON_SECRET (same pattern as other cron routes).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runShipEngineAdjustmentCron()
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({
      summary: result.summary,
      reference_time: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
