import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { ADMIN_SMS_ALERT_PROFILE_ID } from "@/lib/klaviyo/admin-sms-alert-profile"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import type { SupportCaseRow } from "@/lib/db/supportCases"
import { formatSupportCaseReference } from "@/lib/utils/support-case-display"
import {
  adminLiveChatHrefForCase,
  adminSupportCaseHref,
} from "@/lib/utils/support-case-paths"
import { isLiveChatSupportChannel } from "@/lib/utils/support-ticket-display"

export const SUPPORT_TICKET_ADMIN_ALERT_METRIC = "Support Ticket Admin Alert"

export type SupportTicketAdminAlertKind = "case_opened" | "customer_reply"

export type SupportTicketAdminAlertInput = {
  id: string
  subject: string
  preview?: string | null
  source_channel?: string | null
  opened_by?: SupportCaseRow["opened_by"] | null
  uniqueId?: string | null
}

const PREVIEW_MAX = 80

export function supportTicketAdminAlertDeskUrl(input: {
  id: string
  source_channel?: string | null
  origin?: string
}): string {
  const origin = (input.origin ?? publicSiteOriginForEmail()).replace(/\/$/, "")
  const href = isLiveChatSupportChannel(input.source_channel)
    ? adminLiveChatHrefForCase(input.id)
    : adminSupportCaseHref(input.id)
  return `${origin}${href}`
}

export function buildSupportTicketAdminAlertSms(input: {
  kind: SupportTicketAdminAlertKind
  id: string
  subject: string
  preview?: string | null
  ticketUrl: string
}): string {
  const ref = formatSupportCaseReference(input.id)
  const subject = input.subject.trim() || "Support ticket"
  if (input.kind === "case_opened") {
    return `Reswell CS: new ticket ${ref} — ${subject}. ${input.ticketUrl}`
  }
  const preview = (input.preview ?? "").replace(/\s+/g, " ").trim()
  const snippet =
    preview.length > PREVIEW_MAX ? `${preview.slice(0, PREVIEW_MAX)}…` : preview
  const detail = snippet || subject
  return `Reswell CS: reply on ${ref} — ${detail}. ${input.ticketUrl}`
}

export function shouldNotifyStaffSupportCaseOpened(
  openedBy: SupportCaseRow["opened_by"] | null | undefined,
): boolean {
  return openedBy !== "staff"
}

async function sendSupportTicketAdminAlert(args: {
  kind: SupportTicketAdminAlertKind
  case: SupportTicketAdminAlertInput
}): Promise<void> {
  const caseId = args.case.id.trim()
  if (!caseId) return

  const ticketUrl = supportTicketAdminAlertDeskUrl({
    id: caseId,
    source_channel: args.case.source_channel,
  })
  const smsMessage = buildSupportTicketAdminAlertSms({
    kind: args.kind,
    id: caseId,
    subject: args.case.subject,
    preview: args.case.preview,
    ticketUrl,
  })
  const uniqueId =
    args.case.uniqueId?.trim() ||
    (args.kind === "case_opened"
      ? `support-ticket-admin-alert-opened-${caseId}`
      : `support-ticket-admin-alert-reply-${caseId}-${Date.now()}`)

  try {
    const result = await sendKlaviyoServerEvent({
      metricName: SUPPORT_TICKET_ADMIN_ALERT_METRIC,
      profile: { external_id: ADMIN_SMS_ALERT_PROFILE_ID },
      uniqueId,
      properties: {
        alert_kind: args.kind,
        support_ticket_id: caseId,
        case_ref: formatSupportCaseReference(caseId),
        subject: args.case.subject.trim(),
        source_channel: args.case.source_channel ?? "",
        ticket_url: ticketUrl,
        sms_message: smsMessage,
        reswell_metric_seed: false,
      },
    })
    if (!result.ok && !result.skipped) {
      console.error("[support] Support Ticket Admin Alert was not accepted", {
        caseId,
        kind: args.kind,
        status: result.status,
        detail: result.detail,
      })
    }
  } catch (err) {
    console.error("[support] Support Ticket Admin Alert failed", err)
  }
}

/** Fire-and-forget. Never throw — customer writes must succeed without this. */
export function notifyStaffSupportCaseOpened(row: SupportTicketAdminAlertInput): void {
  if (!shouldNotifyStaffSupportCaseOpened(row.opened_by)) return
  void sendSupportTicketAdminAlert({
    kind: "case_opened",
    case: {
      ...row,
      uniqueId: row.uniqueId ?? `support-ticket-admin-alert-opened-${row.id}`,
    },
  })
}

/** Fire-and-forget customer reply on an existing ticket. */
export function notifyStaffSupportCustomerReply(row: SupportTicketAdminAlertInput): void {
  void sendSupportTicketAdminAlert({ kind: "customer_reply", case: row })
}

export async function bootstrapSupportTicketAdminAlertMetric(): Promise<
  | { ok: true; status: number; skipped: boolean; profileId: string }
  | { ok: false; error: string }
> {
  const ticketUrl = `${publicSiteOriginForEmail()}/admin/contact-messages`
  const event = await sendKlaviyoServerEvent({
    metricName: SUPPORT_TICKET_ADMIN_ALERT_METRIC,
    profile: { external_id: ADMIN_SMS_ALERT_PROFILE_ID },
    uniqueId: "support-ticket-admin-alert-metric-seed-v1",
    properties: {
      alert_kind: "case_opened",
      support_ticket_id: "seed",
      case_ref: "RS-SEED",
      subject: "Metric seed",
      source_channel: "help_hub",
      ticket_url: ticketUrl,
      sms_message: "Metric seed — do not send",
      reswell_metric_seed: true,
    },
  })

  if (!event.ok) {
    return {
      ok: false,
      error:
        event.skipReason ??
        `Klaviyo support ticket admin alert seed failed (${event.status || "network error"})`,
    }
  }

  return {
    ok: true,
    status: event.status,
    skipped: event.skipped,
    profileId: ADMIN_SMS_ALERT_PROFILE_ID,
  }
}
