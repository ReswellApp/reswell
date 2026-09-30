import { NextResponse } from "next/server"
import { recoverUnusedShipEnginePostage } from "@/lib/services/recoverUnusedShipEnginePostage"
import { createServiceRoleClient } from "@/lib/supabase/server"

export const maxDuration = 300

/**
 * Twice a day: void ShipEngine labels with no carrier scan for 20 days so postage
 * returns to the ShipEngine balance. Does not refund buyers.
 * Protected with CRON_SECRET (same pattern as other cron routes).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server config: missing service role" }, { status: 503 })
  }

  try {
    const result = await recoverUnusedShipEnginePostage({ supabase })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({
      summary: result.data.summary,
      warnings: result.warnings,
      truncated: result.data.truncated,
      buyerRefundsIssued: result.data.buyerRefundsIssued,
      reference_time: result.data.finishedAt,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
