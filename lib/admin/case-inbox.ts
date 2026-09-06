import type { ContactMessageRow } from "@/lib/db/contactMessages"
import type { OrderSupportRequestRow } from "@/lib/db/order-support"
import {
  orderRequestTypeSubject,
  orderRequestTypeToKind,
  orderSupportStatusToCaseStatus,
  contactStatusToCaseStatus,
  SUPPORT_CASE_STATUS_LABEL,
  SUPPORT_CASE_KIND_LABEL,
} from "@/lib/utils/support-case-display"
import type { SupportCaseKind, SupportCaseStatus } from "@/lib/types/supportCase"
import { supportTicketDisplaySubject } from "@/lib/utils/support-ticket-display"

export type CaseInboxTypeFilter = "all" | "general" | "order" | "claims"
export type CaseInboxStatusFilter = "open" | "new" | "resolved" | "all"

export type CaseInboxItem = {
  key: string
  backend: "contact_message" | "order_support"
  id: string
  subject: string
  preview: string
  fromName: string
  fromEmail: string | null
  userId: string | null
  kind: SupportCaseKind
  kindLabel: string
  status: SupportCaseStatus
  statusLabel: string
  channelLabel: string
  orderId: string | null
  orderRef: string | null
  createdAt: string
  updatedAt: string
  isOpen: boolean
  isNew: boolean
  contact: ContactMessageRow | null
  order: OrderSupportRequestRow | null
}

export function contactToInboxItem(row: ContactMessageRow): CaseInboxItem {
  const status = contactStatusToCaseStatus(row.support_status)
  const kind: SupportCaseKind =
    row.subject?.toLowerCase().includes("safety") || row.message.toLowerCase().includes("Topic: Safety")
      ? "safety"
      : row.subject?.toLowerCase().includes("payment")
        ? "payments"
        : row.subject?.toLowerCase().includes("account")
          ? "account"
          : "general"

  return {
    key: `cm:${row.id}`,
    backend: "contact_message",
    id: row.id,
    subject: supportTicketDisplaySubject(row.subject, row.source),
    preview: row.message,
    fromName: row.name,
    fromEmail: row.email,
    userId: row.user_id,
    kind,
    kindLabel: SUPPORT_CASE_KIND_LABEL[kind],
    status,
    statusLabel: SUPPORT_CASE_STATUS_LABEL[status],
    channelLabel: row.source === "messages_support" ? "Help Hub" : "Website",
    orderId: null,
    orderRef: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOpen: status !== "resolved",
    isNew: status === "submitted",
    contact: row,
    order: null,
  }
}

export function orderToInboxItem(row: OrderSupportRequestRow): CaseInboxItem {
  const kind = orderRequestTypeToKind(row.request_type)
  const status = orderSupportStatusToCaseStatus(row.support_status)
  const subject = orderRequestTypeSubject(row.request_type, row.order_ref)
  const rolePrefix = row.requester_role === "seller" ? "Seller · " : ""

  return {
    key: `os:${row.id}`,
    backend: "order_support",
    id: row.id,
    subject: `${rolePrefix}${subject}`,
    preview: row.body,
    fromName: row.requester_role === "seller" ? "Seller" : "Buyer",
    fromEmail: null,
    userId: row.buyer_id,
    kind,
    kindLabel: SUPPORT_CASE_KIND_LABEL[kind],
    status,
    statusLabel: SUPPORT_CASE_STATUS_LABEL[status],
    channelLabel: "Order",
    orderId: row.order_id,
    orderRef: row.order_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOpen: status !== "resolved",
    isNew: status === "submitted",
    contact: null,
    order: row,
  }
}

export function filterInboxItems(
  items: CaseInboxItem[],
  args: {
    status: CaseInboxStatusFilter
    type: CaseInboxTypeFilter
    search: string
  },
): CaseInboxItem[] {
  const q = args.search.trim().toLowerCase()
  return items.filter((item) => {
    if (args.status === "open" && !item.isOpen) return false
    if (args.status === "new" && !item.isNew) return false
    if (args.status === "resolved" && item.isOpen) return false

    if (args.type === "general" && item.backend !== "contact_message") return false
    if (args.type === "order" && item.backend !== "order_support") return false
    if (args.type === "claims" && item.kind !== "protection_claim") return false

    if (!q) return true
    return (
      item.subject.toLowerCase().includes(q) ||
      item.preview.toLowerCase().includes(q) ||
      item.fromName.toLowerCase().includes(q) ||
      (item.fromEmail?.toLowerCase().includes(q) ?? false) ||
      (item.orderRef?.toLowerCase().includes(q) ?? false) ||
      (item.userId?.toLowerCase().includes(q) ?? false) ||
      item.id.toLowerCase().includes(q)
    )
  })
}
