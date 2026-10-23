import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { getAdminOrdersStats } from "@/lib/services/adminOrdersStats"

/**
 * GET /api/admin/orders/stats
 *
 * Admin / support — payment KPIs, open-fulfillment breakdown, shipping-label ops,
 * and attention queues for the orders dashboard.
 */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  const result = await getAdminOrdersStats()
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ data: result.data }, { status: 200 })
}
