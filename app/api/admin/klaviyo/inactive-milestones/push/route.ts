import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { pushKlaviyoInactiveMilestonesForUser } from "@/lib/services/klaviyoInactiveAdminBackfill"
import { processAllKlaviyoInactivityMilestones } from "@/lib/services/klaviyoInactivityMilestones"
import { klaviyoAdminInactivePushBodySchema } from "@/lib/validations/klaviyoAdminInactiveBackfill"
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
 * Backfill **User Inactive 30 Days** for one user from auth last sign-in (same as /admin/users).
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = klaviyoAdminInactivePushBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server config: missing service role" }, { status: 503 })
  }

  const result = await pushKlaviyoInactiveMilestonesForUser(service, parsed.data.user_id, {
    strategy: parsed.data.strategy,
    force: parsed.data.force,
  })

  return NextResponse.json(result)
}
