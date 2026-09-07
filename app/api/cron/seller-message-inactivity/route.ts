import { createServiceRoleClient } from "@/lib/supabase/server"
import { processSellerMessageInactivity } from "@/lib/services/sellerMessageInactivity"
import { NextResponse } from "next/server"

/**
 * Daily job: unanswered buyer listing messages older than 7 days → vacation mode +
 * Klaviyo **Listing Auto Vacation** (listing hidden) and **Inactive Seller**
 * (missed messages) to the seller.
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
