import type {
  SupportCaseKind,
  SupportCaseStatus,
} from "@/lib/types/supportCase"
import type { ContactMessageSupportStatus } from "@/lib/db/contactMessages"

export const SUPPORT_CASE_STATUS_LABEL: Record<SupportCaseStatus, string> = {
  submitted: "Submitted",
  in_review: "In review",
  in_progress: "In progress",
  waiting_on_you: "Waiting on you",
  resolved: "Resolved",
}

export const SUPPORT_CASE_STATUS_DESCRIPTION: Record<SupportCaseStatus, string> = {
  submitted: "We received your request and will review it shortly.",
  in_review: "A teammate is reviewing the details.",
  in_progress: "Our team is actively working on this with you.",
  waiting_on_you: "We need a reply or more info from you to continue.",
  resolved: "This case is closed. Open a new request anytime if you still need help.",
}

export const SUPPORT_CASE_KIND_LABEL: Record<SupportCaseKind, string> = {
  general: "General help",
  order_question: "Order question",
  cancel_request: "Cancel request",
  protection_claim: "Purchase Protection claim",
  safety: "Safety",
  payments: "Payments & payouts",
  account: "Account",
}

export function supportCaseStatusBadgeVariant(
  status: SupportCaseStatus,
): "default" | "secondary" | "outline" {
  switch (status) {
    case "submitted":
      return "outline"
    case "in_review":
    case "waiting_on_you":
      return "secondary"
    case "in_progress":
      return "default"
    case "resolved":
      return "outline"
    default:
      return "secondary"
  }
}

export function isSupportCaseOpen(status: SupportCaseStatus): boolean {
  return status !== "resolved"
}

/** Short reference shown in lists — e.g. RS-A1B2C3D4 */
export function formatSupportCaseReference(caseId: string): string {
  const compact = caseId.replace(/-/g, "").slice(0, 8).toUpperCase()
  return `RS-${compact}`
}

export function contactStatusToCaseStatus(
  status: ContactMessageSupportStatus,
): SupportCaseStatus {
  switch (status) {
    case "new":
      return "submitted"
    case "triaged":
      return "in_review"
    case "ticket_created":
      return "in_progress"
    case "resolved":
      return "resolved"
    default:
      return "submitted"
  }
}

export function orderSupportStatusToCaseStatus(status: string | null | undefined): SupportCaseStatus {
  switch (status) {
    case "triaged":
      return "in_review"
    case "waiting_on_customer":
      return "waiting_on_you"
    case "investigating":
      return "in_progress"
    case "resolved":
    case "closed":
      return "resolved"
    case "new":
    default:
      return "submitted"
  }
}

export function orderRequestTypeToKind(
  requestType: string,
): SupportCaseKind {
  switch (requestType) {
    case "cancel_order":
      return "cancel_request"
    case "refund_help":
      return "protection_claim"
    case "help":
    default:
      return "order_question"
  }
}

export function orderRequestTypeSubject(requestType: string, orderRef: string): string {
  switch (requestType) {
    case "cancel_order":
      return `Cancel request · ${orderRef}`
    case "refund_help":
      return `Protection claim · ${orderRef}`
    case "help":
    default:
      return `Order help · ${orderRef}`
  }
}
