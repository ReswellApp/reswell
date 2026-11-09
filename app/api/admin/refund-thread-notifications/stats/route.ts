import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { getAdminRefundThreadNotificationsStats } from "@/lib/services/adminRefundThreadNotifications"

/** GET /api/admin/refund-thread-notifications/stats — KPI counts for refund thread notifications. */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  const result = await getAdminRefundThreadNotificationsStats()
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ data: result.data }, { status: 200 })
}
