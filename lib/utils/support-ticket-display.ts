import type { ContactMessageSupportStatus } from "@/lib/db/contactMessages"

/** Customer-facing labels for the support portal (not internal triage jargon). */
export const USER_SUPPORT_STATUS_LABEL: Record<ContactMessageSupportStatus, string> = {
  new: "Submitted",
  triaged: "In review",
  ticket_created: "In progress",
  resolved: "Resolved",
}

export const USER_SUPPORT_STATUS_DESCRIPTION: Record<ContactMessageSupportStatus, string> = {
  new: "We received your request and will review it shortly.",
  triaged: "A teammate is reviewing the details.",
  ticket_created: "Our team is actively working on this with you.",
  resolved: "This request is closed. Reply anytime if you still need help.",
}

export function userSupportStatusBadgeVariant(
  status: ContactMessageSupportStatus,
): "default" | "secondary" | "outline" {
  switch (status) {
    case "new":
      return "outline"
    case "triaged":
      return "secondary"
    case "ticket_created":
      return "default"
    case "resolved":
      return "outline"
    default:
      return "secondary"
  }
}

export function isUserSupportTicketOpen(status: ContactMessageSupportStatus): boolean {
  return status !== "resolved"
}

/** Short reference shown in lists and headers — e.g. RW-A1B2C3D4 */
export function formatSupportTicketReference(ticketId: string): string {
  const compact = ticketId.replace(/-/g, "").slice(0, 8).toUpperCase()
  return `RW-${compact}`
}

import type { ContactMessageSource } from "@/lib/db/contactMessages"

export function supportTicketDisplaySubject(subject: string | null, source: ContactMessageSource): string {
  if (subject?.trim()) {
    return subject.trim()
  }
  if (source === "contact_form") return "Website contact"
  if (source === "live_chat") return "Live chat"
  return "Support request"
}
