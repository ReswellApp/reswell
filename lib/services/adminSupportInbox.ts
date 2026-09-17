import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { listContactMessagesByIds } from "@/lib/db/contactMessages"
import { listOrderSupportRequestsByIds } from "@/lib/db/order-support"
import {
  countSupportCasesAdminFiltered,
  listSupportCasesAdminFiltered,
  listSupportCasesByIds,
  resolveSupportCaseByAnyId,
  searchSupportCaseIdsAdmin,
  type SupportCaseRow,
} from "@/lib/db/supportCases"
import {
  DEFAULT_INBOX_SORT,
  EMPTY_INBOX_VIEW_COUNTS,
  inboxReplyDraftStatus,
  inboxViewFromSearchParams,
  sortInboxItems,
  supportCaseToInboxItem,
  type CaseInboxItem,
  type CaseInboxSort,
  type CaseInboxTypeFilter,
  type CaseInboxView,
  type InboxViewCounts,
} from "@/lib/admin/case-inbox"
import {
  INBOX_OPEN_QUEUE_CAP,
  INBOX_PAGE_SIZE,
  INBOX_SEARCH_MATCH_CAP,
  inboxQueryUsesHistory,
} from "@/lib/admin/case-inbox-query"
import { getContactMessageRowById } from "@/lib/db/contactMessages"
import { getOrderSupportRequestById } from "@/lib/db/order-support"
import {
  ensureCaseForContactMessage,
  ensureCaseForOrderSupport,
} from "@/lib/services/supportCaseBackfill"
import { listSupportReplyDraftMetaByCaseIds } from "@/lib/db/supportReplyDrafts"
import { inboxCaseKey, parseInboxCaseParam } from "@/lib/utils/support-case-paths"
import type { ListAdminSupportInboxQuery } from "@/lib/validations/adminSupportInbox"

export type AdminSupportInboxResult = {
  items: CaseInboxItem[]
  counts: InboxViewCounts
  hasMore: boolean
  nextOffset: number
  searchActive: boolean
}

async function requireStaff() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { ok: false as const, error: "Forbidden" }
  }
  return { ok: true as const, supabase, userId: user.id }
}

async function staffDb() {
  const staff = await requireStaff()
  if (!staff.ok) return staff
  let service
  try {
    service = createServiceRoleClient()
  } catch {
    service = staff.supabase
  }
  return { ok: true as const, service, userId: staff.userId }
}

async function hydrateInboxItems(
  service: ReturnType<typeof createServiceRoleClient> | Awaited<ReturnType<typeof createClient>>,
  cases: SupportCaseRow[],
): Promise<CaseInboxItem[]> {
  const contactIds = cases
    .map((row) => row.contact_message_id)
    .filter((id): id is string => Boolean(id))
  const orderIds = cases
    .map((row) => row.order_support_request_id)
    .filter((id): id is string => Boolean(id))

  const [contacts, orders, drafts] = await Promise.all([
    listContactMessagesByIds(service, contactIds),
    listOrderSupportRequestsByIds(service, orderIds),
    listSupportReplyDraftMetaByCaseIds(
      service,
      cases.map((row) => row.id),
    ),
  ])
  const contactById = new Map(contacts.map((row) => [row.id, row]))
  const orderById = new Map(orders.map((row) => [row.id, row]))
  const draftByCaseId = new Map(drafts.map((row) => [row.caseId, row]))

  return cases.map((row) => {
    const item = supportCaseToInboxItem(row, {
      contact: row.contact_message_id ? contactById.get(row.contact_message_id) ?? null : null,
      order: row.order_support_request_id
        ? orderById.get(row.order_support_request_id) ?? null
        : null,
    })
    const draft = draftByCaseId.get(row.id)
    return {
      ...item,
      replyDraftStatus: inboxReplyDraftStatus({
        isOpen: item.isOpen,
        status: item.status,
        caseUpdatedAt: item.updatedAt,
        draftUpdatedAt: draft?.updatedAt ?? null,
        draftHasBody: draft?.hasBody === true,
      }),
    }
  })
}

function viewListFilter(
  view: CaseInboxView,
  typeOverlay: CaseInboxTypeFilter,
  staffId: string,
  searchActive: boolean,
): Parameters<typeof listSupportCasesAdminFiltered>[1] {
  const type = view === "claims" ? "claims" : typeOverlay
  const kind = type === "claims" ? "protection_claim" : undefined
  const caseType = type === "general" || type === "order" ? type : "all"

  if (searchActive) {
    return {
      status: "all",
      type: caseType,
      kind,
      currentStaffId: staffId,
      limit: INBOX_SEARCH_MATCH_CAP,
    }
  }

  switch (view) {
    case "mine":
      return {
        status: "open",
        assignee: "mine",
        currentStaffId: staffId,
        type: caseType,
        kind,
        limit: INBOX_OPEN_QUEUE_CAP,
      }
    case "unassigned":
      return {
        status: "open",
        assignee: "unassigned",
        type: caseType,
        kind,
        limit: INBOX_OPEN_QUEUE_CAP,
      }
    case "new":
      return {
        status: "submitted",
        type: caseType,
        kind,
        limit: INBOX_OPEN_QUEUE_CAP,
      }
    case "waiting":
      return {
        status: "waiting_on_you",
        type: caseType,
        kind,
        limit: INBOX_OPEN_QUEUE_CAP,
      }
    case "claims":
      return {
        status: "open",
        kind: "protection_claim",
        limit: INBOX_OPEN_QUEUE_CAP,
      }
    case "overdue":
      return {
        status: "open",
        overdueOnly: true,
        type: caseType,
        kind,
        limit: INBOX_OPEN_QUEUE_CAP,
      }
    case "resolved":
      return {
        status: "resolved",
        type: caseType,
        kind,
        limit: INBOX_PAGE_SIZE,
      }
    case "all":
      return {
        status: "all",
        type: caseType,
        kind,
        limit: INBOX_PAGE_SIZE,
      }
    case "open":
    default:
      return {
        status: "open",
        type: caseType,
        kind,
        limit: INBOX_OPEN_QUEUE_CAP,
      }
  }
}

async function countInboxViews(
  service: ReturnType<typeof createServiceRoleClient> | Awaited<ReturnType<typeof createClient>>,
  staffId: string,
): Promise<InboxViewCounts> {
  const base = {}
  const [
    open,
    mine,
    unassigned,
    neu,
    waiting,
    claims,
    overdue,
    resolved,
    all,
  ] = await Promise.all([
    countSupportCasesAdminFiltered(service, { ...base, status: "open" }),
    countSupportCasesAdminFiltered(service, {
      ...base,
      status: "open",
      assignee: "mine",
      currentStaffId: staffId,
    }),
    countSupportCasesAdminFiltered(service, { ...base, status: "open", assignee: "unassigned" }),
    countSupportCasesAdminFiltered(service, { ...base, status: "submitted" }),
    countSupportCasesAdminFiltered(service, { ...base, status: "waiting_on_you" }),
    countSupportCasesAdminFiltered(service, {
      ...base,
      status: "open",
      kind: "protection_claim",
    }),
    countSupportCasesAdminFiltered(service, { ...base, status: "open", overdueOnly: true }),
    countSupportCasesAdminFiltered(service, { ...base, status: "resolved" }),
    countSupportCasesAdminFiltered(service, { ...base, status: "all" }),
  ])

  return { open, mine, unassigned, neu, waiting, claims, overdue, resolved, all }
}

async function loadSelectedCase(
  service: ReturnType<typeof createServiceRoleClient> | Awaited<ReturnType<typeof createClient>>,
  selectedKey: string | null | undefined,
): Promise<CaseInboxItem | null> {
  const rawId = parseInboxCaseParam(selectedKey)
  if (!rawId) return null
  const row = await resolveSupportCaseByAnyId(service, rawId)
  if (!row) return null
  const [item] = await hydrateInboxItems(service, [row])
  return item ?? null
}

export async function listAdminSupportInboxService(
  raw: ListAdminSupportInboxQuery = {
    view: "open",
    type: "all",
    search: "",
    sort: DEFAULT_INBOX_SORT,
    offset: 0,
    limit: INBOX_PAGE_SIZE,
    selected_key: null,
  },
): Promise<AdminSupportInboxResult | { error: string }> {
  const staff = await staffDb()
  if (!staff.ok) return { error: staff.error }

  const search = raw.search.trim()
  const searchActive = search.length > 0
  const view = raw.view
  const type = raw.type
  const sort: CaseInboxSort = raw.sort
  const offset = raw.offset
  const paged = inboxQueryUsesHistory(search, view)
  const filter = viewListFilter(view, type, staff.userId, searchActive)
  const pageLimit = paged ? raw.limit : filter.limit

  let rows: SupportCaseRow[]
  if (searchActive) {
    const matchedIds = await searchSupportCaseIdsAdmin(staff.service, search, INBOX_SEARCH_MATCH_CAP)
    if (matchedIds.length === 0) {
      rows = []
    } else {
      const filtered = await listSupportCasesAdminFiltered(staff.service, {
        ...filter,
        ids: matchedIds,
        limit: INBOX_SEARCH_MATCH_CAP,
        offset: 0,
        order: sort === "oldest" ? "created_asc" : "updated_desc",
      })
      const byId = new Map(filtered.map((row) => [row.id, row]))
      rows = matchedIds.map((id) => byId.get(id)).filter((row): row is SupportCaseRow => Boolean(row))
    }
  } else {
    rows = await listSupportCasesAdminFiltered(staff.service, {
      ...filter,
      limit: pageLimit + 1,
      offset,
      order: sort === "oldest" ? "created_asc" : "updated_desc",
    })
  }

  const hasMore = paged && (searchActive ? rows.length > offset + pageLimit : rows.length > pageLimit)
  const pageRows = searchActive
    ? rows.slice(offset, offset + pageLimit)
    : paged
      ? rows.slice(0, pageLimit)
      : rows.slice(0, pageLimit)

  let items = await hydrateInboxItems(staff.service, pageRows)
  if (!searchActive && !paged) {
    items = sortInboxItems(items, sort)
  } else if (sort === "smart" && searchActive) {
    items = sortInboxItems(items, "recent")
  } else if (sort === "smart") {
    items = sortInboxItems(items, "recent")
  }

  const selected = await loadSelectedCase(staff.service, raw.selected_key)
  if (
    selected &&
    selected.sourceChannel !== "live_chat" &&
    !items.some((item) => item.key === selected.key || item.id === selected.id)
  ) {
    items = [selected, ...items]
  }

  const counts = await countInboxViews(staff.service, staff.userId)

  return {
    items,
    counts,
    hasMore,
    nextOffset: offset + pageRows.length,
    searchActive,
  }
}

export async function getAdminSupportInboxItemService(
  rawId: string,
): Promise<{ item: CaseInboxItem } | { error: string }> {
  const staff = await staffDb()
  if (!staff.ok) return { error: staff.error }
  const item = await loadSelectedCase(staff.service, rawId)
  if (!item) return { error: "Case not found." }
  return { item }
}

export async function resolveAdminInboxHrefService(rawId: string): Promise<string> {
  const parsed = parseInboxCaseParam(rawId) ?? rawId.trim()
  if (!parsed) return "/admin/contact-messages"

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    const supabase = await createClient()
    service = supabase
  }

  let row = await resolveSupportCaseByAnyId(service, parsed)
  if (!row) {
    const order = await getOrderSupportRequestById(service, parsed)
    if (order) {
      row = await ensureCaseForOrderSupport(service, {
        id: order.id,
        request_type: order.request_type,
        body: order.body,
        buyer_id: order.buyer_id,
        order_id: order.order_id,
        order_ref: order.order_ref,
        requester_role: order.requester_role,
      })
    }
  }
  if (!row) {
    const ticket = await getContactMessageRowById(service, parsed)
    if (ticket) {
      row = await ensureCaseForContactMessage(service, {
        id: ticket.id,
        subject: ticket.subject,
        message: ticket.message,
        email: ticket.email,
        user_id: ticket.user_id,
        source: ticket.source,
      })
    }
  }
  if (row) return `/admin/contact-messages?case=${encodeURIComponent(inboxCaseKey(row.id))}`
  return `/admin/contact-messages?case=${encodeURIComponent(inboxCaseKey(parsed))}`
}

export function inboxQueryFromSearchParams(params: {
  view: string | null
  status: string | null
  type: string | null
  assignee: string | null
  tab: string | null
  case: string | null
}): { view: CaseInboxView; type: CaseInboxTypeFilter; selectedKey: string | null } {
  const parsed = inboxViewFromSearchParams(params)
  return {
    view: parsed.view,
    type: parsed.typeOverlay,
    selectedKey: params.case,
  }
}
