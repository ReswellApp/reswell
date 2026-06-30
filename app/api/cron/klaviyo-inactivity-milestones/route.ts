import { createServiceRoleClient } from "@/lib/supabase/server"
import { processAllKlaviyoInactivityMilestones } from "@/lib/services/klaviyoInactivityMilestones"
import { sendInactivitySyncReport } from "@/lib/services/klaviyoInactivitySyncReport"
import { NextResponse } from "next/server"

/**
 * Daily job: emits Klaviyo metric **User Inactive 30 Days** for eligible profiles.
 * Protected with CRON_SECRET (same pattern as purge-archived).
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
    const summaries = await processAllKlaviyoInactivityMilestones(supabase, referenceTime)

    const report = await sendInactivitySyncReport(summaries, referenceTime.toISOString())

    return NextResponse.json({
      summaries,
      report,
      reference_time: referenceTime.toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
