/**
 * Server-only: Klaviyo Events API — fires when support staff notifies a customer about their ticket.
 *
 * **Metric name in Klaviyo:** `Support Tickets Response`
 * **Live flow:** Support Tickets Response (`RuDgCm`) — emails the member when staff reply from
 * the support inbox (or linked support DM / status update), and when Hayden / David
 * or a staff member replies in live chat (`response_type: live_chat_reply`).
 * Live-chat hook: `notifyLiveChatReplyViaKlaviyo`. Inbox hook:
 * `sendSupportCaseAdminReplyService` (`response_type: admin_inbox_reply`), including the
 * opening message when staff open a ticket from the inbox or an admin user profile.
 * HTML paste template: `lib/klaviyo/support-ticket-response-email-liquid.ts`
 *
 * Template properties:
 * - `{{ event.support_ticket_id }}`
 * - `{{ event.response }}` — customer-visible reply body (admin inbox / support DM / status update / live chat)
 * - `{{ event.response_type }}` — `admin_inbox_reply` | `support_dm_reply` | `status_update` | `live_chat_reply`
 * - `{{ event.ticket_url }}` — Help thread, or `/?chat=` for live-chat replies
 * - `{{ event.case_ref }}` — short reference (RS-XXXXXXXX)
 * - `{{ event.reply_to }}` — plus-addressed inbound mailbox when `SUPPORT_INBOUND_REPLY_TO` is set.
 *   Set the Klaviyo flow Reply-To to this so Gmail replies hit `/api/webhooks/inbound-email`.
 *
 * Avoid top-level duplicate email fields — `profile.email` identifies the recipient; keep copy in `response`.
 *
 * @see https://developers.klaviyo.com/en/reference/create_event
 */

import {
  sendKlaviyoServerEvent,
  type SendKlaviyoServerEventResult,
} from "@/lib/klaviyo/send-event"
import { resolveSupportCaseByAnyId } from "@/lib/db/supportCases"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { buildKlaviyoSupportInboundThreading } from "@/lib/utils/support-inbound-email"
import { supportCaseResponseAbsoluteUrl } from "@/lib/utils/support-case-paths"

const RESPONSE_PROP_MAX = 4000

export type KlaviyoSupportTicketResponseType =
  | "status_update"
  | "support_dm_reply"
  | "admin_inbox_reply"
  | "live_chat_reply"

export type KlaviyoSupportTicketResponsePayload = {
  supportTicketId: string
  /**
   * Canonical `support_cases.id`. Inbox-reply / support-DM callers often pass a
   * legacy contact_messages id as `supportTicketId` — inbound `case_ref` and
   * plus-addressed Reply-To must use this UUID (maps to `case_number`).
   */
  supportCaseId?: string | null
  email: string
  externalId?: string | null
  response: string
  responseType: KlaviyoSupportTicketResponseType
  /** Set when `responseType` is `status_update`. */
  supportStatus?: string
  /** Override deep link (defaults to /support/:id). */
  ticketUrl?: string | null
  /** Dedupe — e.g. message id when available. */
  uniqueId: string
}

async function resolveSupportCaseIdForInbound(
  anyId: string,
): Promise<string | null> {
  try {
    const supabase = createServiceRoleClient()
    const row = await resolveSupportCaseByAnyId(supabase, anyId)
    return row?.id ?? null
  } catch (err) {
    console.warn("[klaviyo] inbound case resolve skipped", err)
    return null
  }
}

function trimResponse(text: string): string {
  const t = text.trim()
  if (t.length <= RESPONSE_PROP_MAX) return t
  return `${t.slice(0, RESPONSE_PROP_MAX)}…`
}

function skippedResult(skipReason: string): SendKlaviyoServerEventResult {
  return { ok: false, status: 0, skipped: true, skipReason, detail: "" }
}

export async function trackKlaviyoSupportTicketResponse(
  payload: KlaviyoSupportTicketResponsePayload,
): Promise<SendKlaviyoServerEventResult> {
  const email = payload.email.trim()
  if (!email) {
    console.warn(
      "[klaviyo] Support Tickets Response skipped — no email",
      payload.responseType,
    )
    return skippedResult("no email")
  }

  const supportTicketId = payload.supportTicketId.trim()
  if (!supportTicketId) {
    console.warn("[klaviyo] Support Tickets Response skipped — no ticket id")
    return skippedResult("no ticket id")
  }

  const response = trimResponse(payload.response)
  if (!response) {
    console.warn("[klaviyo] Support Tickets Response skipped — empty response")
    return skippedResult("empty response")
  }

  const time = new Date().toISOString()
  const ext = payload.externalId?.trim() || null
  const resolvedCaseId =
    payload.supportCaseId?.trim() ||
    (await resolveSupportCaseIdForInbound(supportTicketId))
  const threading = buildKlaviyoSupportInboundThreading({
    supportTicketId,
    supportCaseId: resolvedCaseId,
    mailbox: process.env.SUPPORT_INBOUND_REPLY_TO,
  })

  return sendKlaviyoServerEvent({
    metricName: "Support Tickets Response",
    profile: {
      email,
      ...(ext ? { external_id: ext } : {}),
    },
    properties: {
      time,
      support_ticket_id: supportTicketId,
      case_ref: threading.caseRef,
      response,
      response_type: payload.responseType,
      support_status: payload.supportStatus?.trim() ?? "",
      ticket_url:
        payload.ticketUrl?.trim() ||
        supportCaseResponseAbsoluteUrl(
          publicSiteOriginForEmail(),
          threading.threadingCaseId,
        ),
      reply_to: threading.replyTo ?? "",
    },
    uniqueId: payload.uniqueId.trim() || `support-ticket-response-${supportTicketId}-${time}`,
  })
}
