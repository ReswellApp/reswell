import type { ContactMessageRow } from "@/lib/db/contactMessages"
import type { OrderSupportRequestRow } from "@/lib/db/order-support"
import type { SupportCaseRow } from "@/lib/db/supportCases"
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
import { caseSlaState, formatSlaHoursLeft, type CaseSlaState } from "@/lib/help/support-sla"

export type CaseInboxTypeFilter = "all" | "general" | "order" | "claims"
export type CaseInboxStatusFilter = "open" | "new" | "resolved" | "all"
export type CaseInboxAssigneeFilter = "anyone" | "mine" | "unassigned"

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
  assigneeAdminId: string | null
  slaState: CaseSlaState
  slaLabel: string
  contact: ContactMessageRow | null
  order: OrderSupportRequestRow | null
}

function slaFields(
  createdAt: string,
  kind: SupportCaseKind,
  isOpen: boolean,
): Pick<CaseInboxItem, "slaState" | "slaLabel"> {
  const sla = caseSlaState({ createdAtIso: createdAt, kind, isOpen })
  if (sla.state === "resolved") {
    return { slaState: sla.state, slaLabel: "" }
  }
  const unit = formatSlaHoursLeft(sla.hoursLeft)
  return {
    slaState: sla.state,
    slaLabel: sla.state === "overdue" ? `Overdue ${unit}` : `Due ${unit}`,
  }
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
  const isOpen = status !== "resolved"

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
    channelLabel:
      row.source === "live_chat"
        ? "Live chat"
        : row.source === "messages_support"
          ? "Help Hub"
          : "Website",
    orderId: null,
    orderRef: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOpen,
    isNew: status === "submitted",
    assigneeAdminId: row.assignee_admin_id,
    ...slaFields(row.created_at, kind, isOpen),
    contact: row,
    order: null,
  }
}

export function orderToInboxItem(row: OrderSupportRequestRow): CaseInboxItem {
  const kind = orderRequestTypeToKind(row.request_type)
  const status = orderSupportStatusToCaseStatus(row.support_status)
  const subject = orderRequestTypeSubject(row.request_type, row.order_ref)
  const rolePrefix = row.requester_role === "seller" ? "Seller · " : ""
  const isOpen = status !== "resolved"

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
    isOpen,
    isNew: status === "submitted",
    assigneeAdminId: row.assignee_admin_id,
    ...slaFields(row.created_at, kind, isOpen),
    contact: null,
    order: row,
  }
}

function channelLabel(source: string): string {
  if (source === "help_hub" || source === "messages_support") return "Help Hub"
  if (source === "contact_form") return "Website"
  if (source === "order_buyer" || source === "order_seller") return "Order"
  if (source === "live_chat") return "Live chat"
  return "Support"
}

export function supportCaseToInboxItem(
  row: SupportCaseRow,
  sidecar: { contact: ContactMessageRow | null; order: OrderSupportRequestRow | null },
): CaseInboxItem {
  const backend = row.order_support_request_id || row.order_id ? "order_support" : "contact_message"
  const isOpen = row.status !== "resolved"
  return {
    key: `sc:${row.id}`,
    backend,
    id: row.id,
    subject: row.subject,
    preview: row.preview,
    fromName: sidecar.contact?.name || (row.requester_role === "seller" ? "Seller" : row.requester_role === "buyer" ? "Buyer" : "Member"),
    fromEmail: sidecar.contact?.email ?? row.requester_email,
    userId: row.requester_user_id,
    kind: row.kind,
    kindLabel: SUPPORT_CASE_KIND_LABEL[row.kind],
    status: row.status,
    statusLabel: SUPPORT_CASE_STATUS_LABEL[row.status],
    channelLabel: channelLabel(row.source_channel),
    orderId: row.order_id,
    orderRef: row.order_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOpen,
    isNew: row.status === "submitted",
    assigneeAdminId: row.assignee_admin_id,
    ...slaFields(row.created_at, row.kind, isOpen),
    contact: sidecar.contact,
    order: sidecar.order,
  }
}

export function filterInboxItems(
  items: CaseInboxItem[],
  args: {
    status: CaseInboxStatusFilter
    type: CaseInboxTypeFilter
    assignee: CaseInboxAssigneeFilter
    currentStaffId: string | null
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

    if (args.assignee === "mine" && item.assigneeAdminId !== args.currentStaffId) return false
    if (args.assignee === "unassigned" && item.assigneeAdminId) return false

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
