import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { linkGuestContactMessages } from "@/lib/services/linkGuestContactMessages"

export const maxDuration = 60

/**
 * Hourly: links guest contact form tickets (user_id IS NULL) to member accounts when
 * the submitter email matches profiles.email or Auth login email. When support routing
 * is configured, creates the member ↔ support DM thread so the ticket appears in
 * Dashboard → Support with a live conversation.
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

  try {
    const summary = await linkGuestContactMessages(supabase)
    return NextResponse.json({
      ok: true,
      summary,
      reference_time: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] link-guest-contact-messages failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
