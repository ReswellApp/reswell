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
import {
  caseSlaState,
  formatSlaHoursLeft,
  slaHoursForCaseKind,
  type CaseSlaState,
} from "@/lib/help/support-sla"

export type CaseInboxTypeFilter = "all" | "general" | "order" | "claims"
export type CaseInboxStatusFilter = "open" | "new" | "waiting" | "resolved" | "all"
export type CaseInboxAssigneeFilter = "anyone" | "mine" | "unassigned"
export type CaseInboxView =
  | "open"
  | "mine"
  | "unassigned"
  | "new"
  | "waiting"
  | "claims"
  | "overdue"
  | "resolved"
  | "all"
export type CaseInboxPriority = "low" | "normal" | "high" | "urgent"
export type CaseInboxSort = "smart" | "recent" | "oldest"

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
  slaDueAt: string | null
  slaState: CaseSlaState
  slaLabel: string
  priority: CaseInboxPriority
  contact: ContactMessageRow | null
  order: OrderSupportRequestRow | null
}

export function inboxPreviewSnippet(text: string, max = 88): string {
  const compact = text.replace(/\s+/g, " ").trim()
  if (compact.length <= max) return compact
  return `${compact.slice(0, max - 1)}…`
}

export function inboxInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
}

function smartTriageScore(item: CaseInboxItem): number {
  const priorityScore = {
    low: 0,
    normal: 100,
    high: 300,
    urgent: 500,
  }[item.priority]
  const slaScore =
    item.slaState === "overdue"
      ? 600
      : item.slaState === "due_soon"
        ? 350
        : 0
  const stateScore = item.isNew ? 180 : 0
  const assignmentScore = item.assigneeAdminId ? 0 : 60
  return priorityScore + slaScore + stateScore + assignmentScore
}

export function sortInboxItems(
  items: CaseInboxItem[],
  sort: CaseInboxSort,
): CaseInboxItem[] {
  return [...items].sort((a, b) => {
    if (sort === "oldest") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    }
    if (sort === "smart") {
      const scoreDifference = smartTriageScore(b) - smartTriageScore(a)
      if (scoreDifference !== 0) return scoreDifference

      const aDue = a.slaDueAt ? new Date(a.slaDueAt).getTime() : Number.POSITIVE_INFINITY
      const bDue = b.slaDueAt ? new Date(b.slaDueAt).getTime() : Number.POSITIVE_INFINITY
      if (aDue !== bDue) return aDue - bDue
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

export function viewToFilters(view: CaseInboxView): {
  status: CaseInboxStatusFilter
  type: CaseInboxTypeFilter
  assignee: CaseInboxAssigneeFilter
  overdueOnly: boolean
} {
  switch (view) {
    case "mine":
      return { status: "open", type: "all", assignee: "mine", overdueOnly: false }
    case "unassigned":
      return { status: "open", type: "all", assignee: "unassigned", overdueOnly: false }
    case "new":
      return { status: "new", type: "all", assignee: "anyone", overdueOnly: false }
    case "waiting":
      return { status: "waiting", type: "all", assignee: "anyone", overdueOnly: false }
    case "claims":
      return { status: "open", type: "claims", assignee: "anyone", overdueOnly: false }
    case "overdue":
      return { status: "open", type: "all", assignee: "anyone", overdueOnly: true }
    case "resolved":
      return { status: "resolved", type: "all", assignee: "anyone", overdueOnly: false }
    case "all":
      return { status: "all", type: "all", assignee: "anyone", overdueOnly: false }
    case "open":
    default:
      return { status: "open", type: "all", assignee: "anyone", overdueOnly: false }
  }
}

export function inboxViewFromSearchParams(params: {
  view: string | null
  status: string | null
  type: string | null
  assignee: string | null
  tab: string | null
}): { view: CaseInboxView; typeOverlay: CaseInboxTypeFilter } {
  const typeOverlay: CaseInboxTypeFilter =
    params.type === "claims"
      ? "claims"
      : params.type === "general"
        ? "general"
        : params.type === "order" || params.tab === "order-support"
          ? "order"
          : "all"

  const rawView = params.view
  if (
    rawView === "open" ||
    rawView === "mine" ||
    rawView === "unassigned" ||
    rawView === "new" ||
    rawView === "waiting" ||
    rawView === "claims" ||
    rawView === "overdue" ||
    rawView === "resolved" ||
    rawView === "all"
  ) {
    return { view: rawView, typeOverlay }
  }

  if (params.assignee === "mine") return { view: "mine", typeOverlay }
  if (params.assignee === "unassigned") return { view: "unassigned", typeOverlay }
  if (params.status === "new") return { view: "new", typeOverlay }
  if (params.status === "waiting") return { view: "waiting", typeOverlay }
  if (params.status === "resolved") return { view: "resolved", typeOverlay }
  if (params.status === "all") return { view: "all", typeOverlay }
  if (typeOverlay === "claims") return { view: "claims", typeOverlay: "all" }
  return { view: "open", typeOverlay }
}

function slaFields(
  createdAt: string,
  kind: SupportCaseKind,
  isOpen: boolean,
  dueAtIso?: string | null,
): Pick<CaseInboxItem, "slaDueAt" | "slaState" | "slaLabel"> {
  const calculated = caseSlaState({ createdAtIso: createdAt, kind, isOpen })
  const dueAt = dueAtIso ? new Date(dueAtIso) : calculated.dueAt
  const hoursLeft = (dueAt.getTime() - Date.now()) / (60 * 60 * 1000)
  const state: CaseSlaState = !isOpen
    ? "resolved"
    : hoursLeft <= 0
      ? "overdue"
      : hoursLeft <= slaHoursForCaseKind(kind) * 0.25
        ? "due_soon"
        : "on_track"
  if (state === "resolved") {
    return { slaDueAt: dueAt.toISOString(), slaState: state, slaLabel: "" }
  }
  const unit = formatSlaHoursLeft(hoursLeft)
  return {
    slaDueAt: dueAt.toISOString(),
    slaState: state,
    slaLabel: state === "overdue" ? `Overdue ${unit}` : `Due ${unit}`,
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
    channelLabel: row.source === "messages_support" ? "Help Hub" : "Website",
    orderId: null,
    orderRef: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOpen,
    isNew: status === "submitted",
    assigneeAdminId: row.assignee_admin_id,
    ...slaFields(row.created_at, kind, isOpen),
    priority: "normal",
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
    priority: "normal",
    contact: null,
    order: row,
  }
}

function channelLabel(source: string): string {
  if (source === "help_hub" || source === "messages_support") return "Help Hub"
  if (source === "contact_form") return "Website"
  if (source === "order_buyer" || source === "order_seller") return "Order"
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
    ...slaFields(row.created_at, row.kind, isOpen, row.sla_due_at),
    priority: row.priority ?? "normal",
    contact: sidecar.contact,
    order: sidecar.order,
  }
}

export function withInboxStatus(item: CaseInboxItem, status: SupportCaseStatus): CaseInboxItem {
  const isOpen = status !== "resolved"
  return {
    ...item,
    status,
    statusLabel: SUPPORT_CASE_STATUS_LABEL[status],
    isOpen,
    isNew: status === "submitted",
    ...slaFields(item.createdAt, item.kind, isOpen, item.slaDueAt),
    contact: item.contact
      ? {
          ...item.contact,
          support_status:
            status === "resolved"
              ? "resolved"
              : status === "in_review"
                ? "triaged"
                : status === "submitted"
                  ? "new"
                  : "ticket_created",
        }
      : null,
    order: item.order
      ? {
          ...item.order,
          support_status:
            status === "resolved"
              ? "resolved"
              : status === "waiting_on_you"
                ? "waiting_on_customer"
                : status === "in_review"
                  ? "triaged"
                  : status === "in_progress"
                    ? "investigating"
                    : "new",
        }
      : null,
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
    overdueOnly?: boolean
  },
): CaseInboxItem[] {
  const q = args.search.trim().toLowerCase()
  return items.filter((item) => {
    if (args.status === "open" && !item.isOpen) return false
    if (args.status === "new" && !item.isNew) return false
    if (args.status === "waiting" && item.status !== "waiting_on_you") return false
    if (args.status === "resolved" && item.isOpen) return false
    if (args.overdueOnly && item.slaState !== "overdue") return false

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

export {
  firstNonEmptyText,
  nextInboxSelectedKey,
  pinSelectedInboxItem,
} from "@/lib/admin/case-inbox-selection"
