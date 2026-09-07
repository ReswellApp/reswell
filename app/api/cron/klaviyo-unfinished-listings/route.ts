import { createServiceRoleClient } from "@/lib/supabase/server"
import { processUnfinishedListingNudges } from "@/lib/services/unfinishedListingNudges"
import { NextResponse } from "next/server"

/**
 * Hourly job: signed-in draft listings idle for 2+ hours → Klaviyo **Unfinished Listing**.
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
    const summary = await processUnfinishedListingNudges(supabase, referenceTime)
    return NextResponse.json({
      ...summary,
      reference_time: referenceTime.toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
