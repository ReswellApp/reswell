import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { getPickupOnlySurfboardsDashboard } from "@/lib/services/pickupOnlySurfboards"

export const dynamic = "force-dynamic"

/**
 * Active surfboards that are local pickup only — grouped by city for local ads.
 * GET /api/admin/pickup-only-surfboards
 */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  try {
    const data = await getPickupOnlySurfboardsDashboard()
    return NextResponse.json({ data }, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[admin/pickup-only-surfboards]", message)
    return NextResponse.json({ error: "Could not load pickup-only surfboards" }, { status: 500 })
  }
}
