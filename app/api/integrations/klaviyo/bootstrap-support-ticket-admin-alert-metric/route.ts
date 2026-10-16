import { NextResponse } from "next/server"
import { ADMIN_SMS_ALERT_PROFILE_ID } from "@/lib/klaviyo/admin-sms-alert-profile"
import {
  SUPPORT_TICKET_ADMIN_ALERT_METRIC,
  bootstrapSupportTicketAdminAlertMetric,
} from "@/lib/services/adminSupportAlerts"

/**
 * Seeds the Klaviyo metric used by staff CS SMS.
 * Protected with CRON_SECRET when configured.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await bootstrapSupportTicketAdminAlertMetric()
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      data: result,
      message:
        `Metric "${SUPPORT_TICKET_ADMIN_ALERT_METRIC}" seeded for Klaviyo profile external ID "${ADMIN_SMS_ALERT_PROFILE_ID}". Add the admin phone and transactional SMS consent to that profile (same profile as ShipEngine adjustment alerts), then create a flow triggered by that metric, filter reswell_metric_seed != true, and add a transactional SMS using {{ event.sms_message }}.`,
    })
  } catch (error) {
    console.error("[klaviyo] Support Ticket Admin Alert metric bootstrap failed:", error)
    return NextResponse.json(
      { error: "Could not seed the Support Ticket Admin Alert metric" },
      { status: 500 },
    )
  }
}
