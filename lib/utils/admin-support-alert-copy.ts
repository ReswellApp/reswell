import { formatSupportCaseReference } from "./support-case-display.ts"
import {
  adminLiveChatHrefForCase,
  adminSupportCaseHref,
} from "./support-case-paths.ts"

export type SupportTicketAdminAlertKind = "case_opened" | "customer_reply"

const PREVIEW_MAX = 80

export function shouldNotifyStaffSupportCaseOpened(
  openedBy: "requester" | "staff" | null | undefined,
): boolean {
  return openedBy !== "staff"
}

export function supportTicketAdminAlertDeskUrl(input: {
  id: string
  source_channel?: string | null
  origin: string
}): string {
  const origin = input.origin.replace(/\/$/, "")
  const href =
    input.source_channel === "live_chat"
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
