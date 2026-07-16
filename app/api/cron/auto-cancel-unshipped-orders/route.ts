import { createServiceRoleClient } from "@/lib/supabase/server"
import { AUTO_CANCEL_UNSHIPPED_ORDERS_ENABLED } from "@/lib/shipping-deadline"
import { autoCancelUnshippedOrders } from "@/lib/services/autoCancelUnshippedOrders"
import { NextResponse } from "next/server"

/**
 * Daily job: auto-cancel shipping orders where the seller has not shipped within 7 days.
 * Disabled via AUTO_CANCEL_UNSHIPPED_ORDERS_ENABLED until we revisit the policy.
 * Protected with CRON_SECRET (same pattern as purge-archived).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!AUTO_CANCEL_UNSHIPPED_ORDERS_ENABLED) {
    return NextResponse.json({
      disabled: true,
      message: "Auto-cancel unshipped orders is disabled.",
    })
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server config: missing service role" }, { status: 503 })
  }

  const referenceTime = new Date()

  try {
    const summary = await autoCancelUnshippedOrders(supabase, referenceTime)

    return NextResponse.json({
      summary,
      reference_time: referenceTime.toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
