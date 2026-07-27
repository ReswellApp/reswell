/**
 * Server-only: Klaviyo Events API — fires when a customer opens a support ticket.
 *
 * **Metric name in Klaviyo:** `Support Tickets` — use as the flow trigger for a “we got your
 * message” confirmation. Template properties:
 * - `{{ event.support_ticket_id }}` — Ticket ID (same as in-app)
 * - `{{ event.subject }}` — topic / subject line
 * - `{{ event.message }}` — original request body
 * - `{{ event.ticket_url }}` — Dashboard → Support deep link (contact / Messages tickets)
 * - `{{ event.order_ref }}` — order label when applicable
 *
 * @see https://developers.klaviyo.com/en/reference/create_event
 */

import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"

const MESSAGE_PROP_MAX = 4000

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
  /** Customer’s original request text (quoted in confirmation email). */
  message?: string | null
  /** Human-friendly order label when the ticket is tied to an order. */
  orderRef?: string | null
}

function trimMessage(text: string): string {
  const t = text.trim()
  if (t.length <= MESSAGE_PROP_MAX) return t
  return `${t.slice(0, MESSAGE_PROP_MAX)}…`
}

function supportTicketUrl(source: KlaviyoSupportTicketSource, ticketId: string): string {
  // Order-support rows live outside `contact_messages` /dashboard/support.
  if (source === "order_buyer_support" || source === "order_seller_support") {
    return ""
  }
  return `${publicSiteOriginForEmail()}/dashboard/support/${ticketId}`
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
  const message = trimMessage(payload.message ?? "")

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
      message,
      ticket_url: supportTicketUrl(payload.source, supportTicketId),
      order_ref: payload.orderRef?.trim() ?? "",
    },
    uniqueId: `support-ticket-${supportTicketId}`,
  })
}
