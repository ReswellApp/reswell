import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { ADMIN_SMS_ALERT_PROFILE_ID } from "@/lib/klaviyo/admin-sms-alert-profile"
import {
  SUPPORT_TICKET_ADMIN_ALERT_METRIC,
  bootstrapSupportTicketAdminAlertMetric,
} from "@/lib/services/adminSupportAlerts"

/** Admin session: seed Support Ticket Admin Alert so it appears in Klaviyo Flows. */
export async function POST() {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  try {
    const result = await bootstrapSupportTicketAdminAlertMetric()
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      data: result,
      message:
        `Seeded "${SUPPORT_TICKET_ADMIN_ALERT_METRIC}" on profile "${ADMIN_SMS_ALERT_PROFILE_ID}". Create a transactional SMS flow on that metric; filter reswell_metric_seed is not true.`,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
