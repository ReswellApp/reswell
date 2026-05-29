import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { getAdminShippingStats } from "@/lib/services/adminShippingStats"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/shipping/stats — aggregated shipping analytics for the admin dashboard.
 */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  const result = await getAdminShippingStats()
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ data: result.data })
}
