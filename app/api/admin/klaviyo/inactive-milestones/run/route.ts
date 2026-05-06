import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { processAllKlaviyoInactivityMilestones } from "@/lib/services/klaviyoInactivityMilestones"
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
 * Same work as `GET /api/cron/klaviyo-inactivity-milestones`, but authorized by **admin session**
 * (no `CRON_SECRET`). Use from the admin UI to backfill everyone who matches the cron rules.
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
  const summaries = await processAllKlaviyoInactivityMilestones(service, referenceTime)

  return NextResponse.json({
    reference_time: referenceTime.toISOString(),
    summaries,
  })
}
