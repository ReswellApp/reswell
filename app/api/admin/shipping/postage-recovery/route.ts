import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  getLatestPostageRecovery,
  recoverUnusedShipEnginePostage,
} from "@/lib/services/recoverUnusedShipEnginePostage"
import { createServiceRoleClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * GET  — latest unused-postage audit.
 * POST — run the audit now and void labels that have not been scanned for 20 days.
 * Postage is credited to the ShipEngine balance. Buyers are not refunded.
 */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const result = await getLatestPostageRecovery(supabase)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: result.data })
}

export async function POST() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const result = await recoverUnusedShipEnginePostage({ supabase, force: true })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: result.data, warnings: result.warnings })
}
