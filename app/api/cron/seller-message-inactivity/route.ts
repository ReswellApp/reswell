import { createServiceRoleClient } from "@/lib/supabase/server"
import { processSellerMessageInactivity } from "@/lib/services/sellerMessageInactivity"
import { NextResponse } from "next/server"

/**
 * Daily job for unanswered buyer listing messages:
 * day 3 — in-app notice + Klaviyo **Seller Still Here**
 * day 6 — in-app hide warning + Klaviyo **Seller Listing Hide Warning**
 * day 7 — vacation mode, in-app notice, Klaviyo **Listing Auto Vacation** and **Inactive Seller**
 *
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
    const summary = await processSellerMessageInactivity(supabase, referenceTime)

    return NextResponse.json({
      ...summary,
      reference_time: referenceTime.toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
