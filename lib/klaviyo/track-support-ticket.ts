/**
 * Server-only: Klaviyo Events API — fires when a customer opens a support ticket.
 *
 * **Metric name in Klaviyo:** `Support Tickets` — use as the flow trigger to email the requester
 * their reference. In the template, use event property `support_ticket_id` (same value shown in-app
 * as “Ticket ID” for Messages support / contact inbox rows).
 *
 * @see https://developers.klaviyo.com/en/reference/create_event
 */

import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type KlaviyoSupportTicketSource =
  | "messages_support"
  | "contact_form"
  | "order_buyer_support"
  | "order_seller_support"

export type KlaviyoSupportTicketPayload = {
  supportTicketId: string
  email: string
  /** Logged-in Supabase user id when known (contact form guests omit). */
  externalId?: string | null
  source: KlaviyoSupportTicketSource
  subject?: string | null
  /** Human-friendly order label when the ticket is tied to an order. */
  orderRef?: string | null
}

export async function trackKlaviyoSupportTicketCreated(
  payload: KlaviyoSupportTicketPayload,
): Promise<void> {
  const email = payload.email.trim()
  if (!email) {
    console.warn(
      "[klaviyo] Support Tickets event skipped — no email",
      payload.source,
    )
    return
  }

  const supportTicketId = payload.supportTicketId.trim()
  if (!supportTicketId) {
    console.warn("[klaviyo] Support Tickets event skipped — no ticket id")
    return
  }

  const time = new Date().toISOString()
  const ext = payload.externalId?.trim() || null

  await sendKlaviyoServerEvent({
    metricName: "Support Tickets",
    profile: {
      email,
      ...(ext ? { external_id: ext } : {}),
    },
    properties: {
      time,
      support_ticket_id: supportTicketId,
      source: payload.source,
      subject: payload.subject?.trim() ?? "",
      order_ref: payload.orderRef?.trim() ?? "",
    },
    uniqueId: `support-ticket-${supportTicketId}`,
  })
}
