/**
 * Unified support case model for the Help Hub + My Cases portal.
 * Phase 1 adapters map contact_messages + order_support_requests into this shape.
 */

export type SupportCaseKind =
  | "general"
  | "order_question"
  | "cancel_request"
  | "protection_claim"
  | "safety"
  | "payments"
  | "account"

/** Customer-facing case status (normalized across sources). */
export type SupportCaseStatus =
  | "submitted"
  | "in_review"
  | "in_progress"
  | "waiting_on_you"
  | "resolved"

export type SupportCaseSourceChannel =
  | "help_hub"
  | "contact_form"
  | "messages_support"
  | "order_buyer"
  | "order_seller"

export type SupportCaseBackend = "contact_message" | "order_support"

export interface UserSupportCaseListItem {
  id: string
  backend: SupportCaseBackend
  kind: SupportCaseKind
  status: SupportCaseStatus
  subject: string
  preview: string
  orderId: string | null
  orderRef: string | null
  createdAt: string
  updatedAt: string
  hasThread: boolean
  href: string
}

export type HelpHubIntentId =
  | "order"
  | "buying_selling"
  | "payments"
  | "account"
  | "safety"
  | "general"
  | "other"

export type OrderHelpIssueId = "question" | "cancel" | "claim"
