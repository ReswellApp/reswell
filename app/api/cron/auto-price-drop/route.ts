import { createServiceRoleClient } from "@/lib/supabase/server"
import { applyDueListingAutoPriceDrops } from "@/lib/services/listingAutoPriceDrop"
import { NextResponse } from "next/server"

/**
 * Hourly job: apply seller-opted “drop the price in 2 weeks” floors.
 * Sets compare_at_price so browse/PDP show the previous price as markdown.
 * Protected with CRON_SECRET (same pattern as other cron routes).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server config: missing service role" }, { status: 503 })
  }

  const referenceTime = new Date()

  try {
    const summary = await applyDueListingAutoPriceDrops(supabase, referenceTime)

    return NextResponse.json({
      summary,
      reference_time: referenceTime.toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] auto-price-drop failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
