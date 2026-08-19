import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { processGiveawayListingReminders } from "@/lib/services/giveawayListingNudges"
import { NextResponse } from "next/server"

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) return null
  return user
}

/**
 * Same work as `GET /api/cron/klaviyo-giveaway-listing-reminders`, but authorized
 * by admin session. Sends immediately to every pending raffle entry with no listing
 * (`minAgeHours: 0`) so the current “Not listed yet” cohort can be nudged now.
 */
export async function POST() {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server config: missing service role" }, { status: 503 })
  }

  const referenceTime = new Date()
  const summary = await processGiveawayListingReminders(service, {
    referenceTime,
    minAgeHours: 0,
  })

  return NextResponse.json({
    reference_time: referenceTime.toISOString(),
    ...summary,
  })
}
