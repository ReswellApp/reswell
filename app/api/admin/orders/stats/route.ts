import { NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { getAdminOrdersStats } from "@/lib/services/adminOrdersStats"

/**
 * GET /api/admin/orders/stats
 *
 * Admin / support — order count KPIs by status for the orders dashboard.
 */
export async function GET() {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) {
    return gate.response
  }

  const result = await getAdminOrdersStats()
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ data: result.data }, { status: 200 })
}
