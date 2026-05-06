/**
 * Server-only: Klaviyo Events API — fires when support staff notifies a customer about their ticket.
 *
 * **Metric name in Klaviyo:** `Support Tickets Response` — trigger transactional email to the ticket
 * requester (`profile` below). Uses `support_ticket_id` to align with metric **Support Tickets**;
 * `response` is the customer-visible text (workflow status blast or support DM reply).
 *
 * Avoid top-level duplicate email fields — `profile.email` identifies the recipient; keep copy in `response`.
 *
 * @see https://developers.klaviyo.com/en/reference/create_event
 */

import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

const RESPONSE_PROP_MAX = 4000

export type KlaviyoSupportTicketResponseType = "status_update" | "support_dm_reply" | "admin_inbox_reply"

export type KlaviyoSupportTicketResponsePayload = {
  supportTicketId: string
  email: string
  externalId?: string | null
  response: string
  responseType: KlaviyoSupportTicketResponseType
  /** Set when `responseType` is `status_update`. */
  supportStatus?: string
  /** Dedupe — e.g. message id when available. */
  uniqueId: string
}

function trimResponse(text: string): string {
  const t = text.trim()
  if (t.length <= RESPONSE_PROP_MAX) return t
  return `${t.slice(0, RESPONSE_PROP_MAX)}…`
}

export async function trackKlaviyoSupportTicketResponse(
  payload: KlaviyoSupportTicketResponsePayload,
): Promise<void> {
  const email = payload.email.trim()
  if (!email) {
    console.warn(
      "[klaviyo] Support Tickets Response skipped — no email",
      payload.responseType,
    )
    return
  }

  const supportTicketId = payload.supportTicketId.trim()
  if (!supportTicketId) {
    console.warn("[klaviyo] Support Tickets Response skipped — no ticket id")
    return
  }

  const response = trimResponse(payload.response)
  if (!response) {
    console.warn("[klaviyo] Support Tickets Response skipped — empty response")
    return
  }

  const time = new Date().toISOString()
  const ext = payload.externalId?.trim() || null

  await sendKlaviyoServerEvent({
    metricName: "Support Tickets Response",
    profile: {
      email,
      ...(ext ? { external_id: ext } : {}),
    },
    properties: {
      time,
      support_ticket_id: supportTicketId,
      response,
      response_type: payload.responseType,
      support_status: payload.supportStatus?.trim() ?? "",
    },
    uniqueId: payload.uniqueId.trim() || `support-ticket-response-${supportTicketId}-${time}`,
  })
}
