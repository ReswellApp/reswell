import type { SupabaseClient } from "@supabase/supabase-js"
import type { SupportCaseKind, SupportCaseStatus } from "@/lib/types/supportCase"
import { formatSupportCaseReference } from "@/lib/utils/support-case-display"

export type SupportCaseRow = {
  id: string
  case_number: string
  kind: SupportCaseKind
  status: SupportCaseStatus
  priority: "low" | "normal" | "high" | "urgent"
  subject: string
  preview: string
  requester_user_id: string | null
  requester_email: string | null
  requester_role: "buyer" | "seller" | "member" | "guest"
  order_id: string | null
  order_ref: string | null
  listing_id: string | null
  conversation_id: string | null
  contact_message_id: string | null
  order_support_request_id: string | null
  assignee_admin_id: string | null
  sla_due_at: string | null
  outcome: string | null
  internal_notes: string | null
  source_channel: string
  opened_by: "requester" | "staff"
  requester_last_read_at: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
}

export type SupportMacroRow = {
  id: string
  title: string
  body: string
  kind_filter: string | null
  is_active: boolean
  sort_order: number
}

const CASE_SELECT =
  "id, case_number, kind, status, priority, subject, preview, requester_user_id, requester_email, requester_role, order_id, order_ref, listing_id, conversation_id, contact_message_id, order_support_request_id, assignee_admin_id, sla_due_at, outcome, internal_notes, source_channel, opened_by, requester_last_read_at, created_at, updated_at, resolved_at"

function caseNumberFromId(id: string): string {
  return formatSupportCaseReference(id).replace("RS-", "RS-")
}

function slaHoursForKind(kind: SupportCaseKind, priority: string): number {
  if (kind === "safety" || priority === "urgent") return 4
  if (kind === "protection_claim" || kind === "cancel_request") return 24
  return 48
}

export async function insertSupportCase(
  supabase: SupabaseClient,
  row: {
    kind: SupportCaseKind
    subject: string
    preview: string
    requester_user_id?: string | null
    requester_email?: string | null
    requester_role?: "buyer" | "seller" | "member" | "guest"
    order_id?: string | null
    order_ref?: string | null
    listing_id?: string | null
    conversation_id?: string | null
    contact_message_id?: string | null
    order_support_request_id?: string | null
    source_channel: string
    opened_by?: "requester" | "staff"
    priority?: "low" | "normal" | "high" | "urgent"
  },
): Promise<{ data: SupportCaseRow | null; error: Error | null }> {
  const id = crypto.randomUUID()
  const priority = row.priority ?? (row.kind === "safety" ? "urgent" : "normal")
  const hours = slaHoursForKind(row.kind, priority)
  const slaDue = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("support_cases")
    .insert({
      id,
      case_number: caseNumberFromId(id),
      kind: row.kind,
      status: "submitted",
      priority,
      subject: row.subject,
      preview: row.preview.slice(0, 500),
      requester_user_id: row.requester_user_id ?? null,
      requester_email: row.requester_email ?? null,
      requester_role: row.requester_role ?? "member",
      order_id: row.order_id ?? null,
      order_ref: row.order_ref ?? null,
      listing_id: row.listing_id ?? null,
      conversation_id: row.conversation_id ?? null,
      contact_message_id: row.contact_message_id ?? null,
      order_support_request_id: row.order_support_request_id ?? null,
      source_channel: row.source_channel,
      opened_by: row.opened_by ?? "requester",
      sla_due_at: slaDue,
    })
    .select(CASE_SELECT)
    .single()

  if (error) {
    // Table may not exist until migration is applied — soft-fail dual-write.
    console.warn("[support_cases] insert skipped:", error.message)
    return { data: null, error: new Error(error.message) }
  }

  return { data: data as SupportCaseRow, error: null }
}

export type SupportCaseMessageRow = {
  id: string
  case_id: string
  author_user_id: string | null
  author_role: "customer" | "agent" | "system"
  body: string
  is_internal: boolean
  created_at: string
}

export type SupportCaseEventRow = {
  id: string
  case_id: string
  actor_admin_id: string | null
  event_type: string
  payload: Record<string, unknown>
  created_at: string
}

export async function insertSupportCaseMessage(
  supabase: SupabaseClient,
  row: {
    case_id: string
    author_user_id?: string | null
    author_role: "customer" | "agent" | "system"
    body: string
    is_internal?: boolean
    inbound_email_id?: string | null
  },
): Promise<{ id: string | null; error: Error | null; duplicate?: boolean }> {
  const insert: Record<string, unknown> = {
    case_id: row.case_id,
    author_user_id: row.author_user_id ?? null,
    author_role: row.author_role,
    body: row.body,
    is_internal: row.is_internal ?? false,
  }
  if (row.inbound_email_id?.trim()) {
    insert.inbound_email_id = row.inbound_email_id.trim()
  }

  const { data, error } = await supabase
    .from("support_case_messages")
    .insert(insert)
    .select("id")
    .single()
  if (error) {
    if (error.code === "23505" && row.inbound_email_id?.trim()) {
      return { id: null, error: null, duplicate: true }
    }
    console.warn("[support_case_messages] insert skipped:", error.message)
    return { id: null, error: new Error(error.message) }
  }
  return { id: data?.id ? String(data.id) : null, error: null }
}

export async function getSupportCaseMessageByInboundEmailId(
  supabase: SupabaseClient,
  inboundEmailId: string,
): Promise<{ id: string; case_id: string } | null> {
  const { data, error } = await supabase
    .from("support_case_messages")
    .select("id, case_id")
    .eq("inbound_email_id", inboundEmailId)
    .maybeSingle()
  if (error || !data) return null
  return { id: String(data.id), case_id: String(data.case_id) }
}

export async function getSupportCaseByCaseNumber(
  supabase: SupabaseClient,
  caseNumber: string,
): Promise<SupportCaseRow | null> {
  const { data, error } = await supabase
    .from("support_cases")
    .select(CASE_SELECT)
    .ilike("case_number", caseNumber.trim())
    .maybeSingle()
  if (error || !data) return null
  return data as SupportCaseRow
}

export async function listSupportCasesByRequesterEmail(
  supabase: SupabaseClient,
  email: string,
  opts?: { openOnly?: boolean; limit?: number },
): Promise<SupportCaseRow[]> {
  let query = supabase
    .from("support_cases")
    .select(CASE_SELECT)
    .ilike("requester_email", email.trim())
    .order("updated_at", { ascending: false })
    .limit(opts?.limit ?? 8)

  if (opts?.openOnly) query = query.neq("status", "resolved")

  const { data, error } = await query
  if (error) {
    console.warn("[support_cases] email list skipped:", error.message)
    return []
  }
  return (data ?? []) as SupportCaseRow[]
}

export async function getSupportCaseById(
  supabase: SupabaseClient,
  id: string,
): Promise<SupportCaseRow | null> {
  const { data, error } = await supabase.from("support_cases").select(CASE_SELECT).eq("id", id).maybeSingle()
  if (error || !data) return null
  return data as SupportCaseRow
}

/** Resolve a case by its id or a legacy ticket id. */
export async function resolveSupportCaseByAnyId(
  supabase: SupabaseClient,
  id: string,
): Promise<SupportCaseRow | null> {
  const direct = await getSupportCaseById(supabase, id)
  if (direct) return direct
  const byOrder = await getSupportCaseByOrderSupportId(supabase, id)
  if (byOrder) return byOrder
  return getSupportCaseByContactMessageId(supabase, id)
}

export async function listSupportCasesForRequester(
  supabase: SupabaseClient,
  userId: string,
  filter: "all" | "open" | "resolved" = "all",
): Promise<SupportCaseRow[]> {
  let query = supabase
    .from("support_cases")
    .select(CASE_SELECT)
    .eq("requester_user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(200)

  if (filter === "open") query = query.neq("status", "resolved")
  if (filter === "resolved") query = query.eq("status", "resolved")

  const { data, error } = await query
  if (error) {
    console.warn("[support_cases] member list skipped:", error.message)
    return []
  }
  return (data ?? []) as SupportCaseRow[]
}

export async function countOpenSupportCasesForRequester(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("support_cases")
    .select("id", { count: "exact", head: true })
    .eq("requester_user_id", userId)
    .neq("status", "resolved")
  if (error) return 0
  return count ?? 0
}

export async function listSupportCaseMessages(
  supabase: SupabaseClient,
  caseId: string,
  opts?: { includeInternal?: boolean },
): Promise<SupportCaseMessageRow[]> {
  let query = supabase
    .from("support_case_messages")
    .select("id, case_id, author_user_id, author_role, body, is_internal, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true })
    .limit(500)

  if (!opts?.includeInternal) query = query.eq("is_internal", false)

  const { data, error } = await query
  if (error) {
    console.warn("[support_case_messages] list skipped:", error.message)
    return []
  }
  return (data ?? []) as SupportCaseMessageRow[]
}

export async function touchSupportCaseAfterMessage(
  supabase: SupabaseClient,
  args: { id: string; preview: string; status?: SupportCaseStatus },
): Promise<void> {
  const patch: Record<string, unknown> = {
    preview: args.preview.slice(0, 500),
    updated_at: new Date().toISOString(),
  }
  if (args.status) {
    patch.status = args.status
    if (args.status === "resolved") patch.resolved_at = new Date().toISOString()
  }
  const { error } = await supabase.from("support_cases").update(patch).eq("id", args.id)
  if (error) console.warn("[support_cases] touch skipped:", error.message)
}

export async function listSupportMacros(
  supabase: SupabaseClient,
): Promise<SupportMacroRow[]> {
  const { data, error } = await supabase
    .from("support_macros")
    .select("id, title, body, kind_filter, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error) {
    console.warn("[support_macros] list skipped:", error.message)
    return []
  }
  return (data ?? []) as SupportMacroRow[]
}

export async function updateSupportCaseAdmin(
  supabase: SupabaseClient,
  args: {
    id: string
    status?: SupportCaseStatus
    assignee_admin_id?: string | null
    internal_notes?: string | null
    outcome?: string | null
    priority?: "low" | "normal" | "high" | "urgent"
  },
): Promise<{ error: Error | null }> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (args.status !== undefined) {
    patch.status = args.status
    patch.resolved_at = args.status === "resolved" ? new Date().toISOString() : null
  }
  if (args.assignee_admin_id !== undefined) patch.assignee_admin_id = args.assignee_admin_id
  if (args.internal_notes !== undefined) patch.internal_notes = args.internal_notes
  if (args.outcome !== undefined) patch.outcome = args.outcome
  if (args.priority !== undefined) patch.priority = args.priority

  const { error } = await supabase.from("support_cases").update(patch).eq("id", args.id)
  if (error) return { error: new Error(error.message) }
  return { error: null }
}

export async function linkSupportCaseToOrderAdmin(
  supabase: SupabaseClient,
  args: {
    id: string
    order_id: string
    order_ref: string | null
    listing_id: string | null
    requester_user_id: string
  },
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("support_cases")
    .update({
      order_id: args.order_id,
      order_ref: args.order_ref,
      listing_id: args.listing_id,
      requester_user_id: args.requester_user_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.id)

  return { error: error ? new Error(error.message) : null }
}

export async function insertSupportCaseEvent(
  supabase: SupabaseClient,
  row: {
    case_id: string
    actor_admin_id?: string | null
    event_type: string
    payload?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await supabase.from("support_case_events").insert({
    case_id: row.case_id,
    actor_admin_id: row.actor_admin_id ?? null,
    event_type: row.event_type,
    payload: row.payload ?? {},
  })
  if (error) {
    console.warn("[support_case_events] insert skipped:", error.message)
  }
}

export async function listSupportCaseEvents(
  supabase: SupabaseClient,
  caseId: string,
  limit = 100,
): Promise<SupportCaseEventRow[]> {
  const { data, error } = await supabase
    .from("support_case_events")
    .select("id, case_id, actor_admin_id, event_type, payload, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.warn("[support_case_events] list skipped:", error.message)
    return []
  }
  return (data ?? []) as SupportCaseEventRow[]
}

export async function listSupportCasesAdmin(
  supabase: SupabaseClient,
  limit = 200,
): Promise<SupportCaseRow[]> {
  return listSupportCasesAdminFiltered(supabase, { limit })
}

export type AdminSupportCaseListFilter = {
  status?: "open" | "resolved" | "submitted" | "waiting_on_you" | "all"
  assignee?: "anyone" | "mine" | "unassigned"
  currentStaffId?: string | null
  overdueOnly?: boolean
  kind?: SupportCaseKind
  type?: "all" | "general" | "order"
  ids?: string[]
  excludeLiveChat?: boolean
  limit: number
  offset?: number
  order?: "updated_desc" | "updated_asc" | "created_asc"
}

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/"/g, '\\"')
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type LooseCaseQuery = {
  eq: (column: string, value: unknown) => LooseCaseQuery
  neq: (column: string, value: unknown) => LooseCaseQuery
  is: (column: string, value: unknown) => LooseCaseQuery
  or: (filters: string) => LooseCaseQuery
  in: (column: string, values: string[]) => LooseCaseQuery
  lt: (column: string, value: string) => LooseCaseQuery
  order: (column: string, options: { ascending: boolean }) => LooseCaseQuery
  range: (from: number, to: number) => LooseCaseQuery
} & PromiseLike<{
  data: unknown
  count: number | null
  error: { message: string } | null
}>

function applyAdminCaseFilters(
  query: unknown,
  filter: Omit<AdminSupportCaseListFilter, "limit" | "offset" | "order">,
): LooseCaseQuery {
  let next = query as LooseCaseQuery
  if (filter.excludeLiveChat !== false) {
    next = next.neq("source_channel", "live_chat")
  }
  if (filter.ids && filter.ids.length > 0) {
    next = next.in("id", filter.ids)
  }
  if (filter.status === "open") next = next.neq("status", "resolved")
  else if (filter.status === "resolved") next = next.eq("status", "resolved")
  else if (filter.status === "submitted") next = next.eq("status", "submitted")
  else if (filter.status === "waiting_on_you") next = next.eq("status", "waiting_on_you")

  if (filter.assignee === "mine" && filter.currentStaffId) {
    next = next.eq("assignee_admin_id", filter.currentStaffId)
  } else if (filter.assignee === "unassigned") {
    next = next.is("assignee_admin_id", null)
  }

  if (filter.overdueOnly) {
    next = next.neq("status", "resolved").lt("sla_due_at", new Date().toISOString())
  }
  if (filter.kind) next = next.eq("kind", filter.kind)
  if (filter.type === "general") {
    next = next.is("order_id", null).is("order_support_request_id", null)
  } else if (filter.type === "order") {
    next = next.or("order_id.not.is.null,order_support_request_id.not.is.null")
  }
  return next
}

export async function listSupportCasesAdminFiltered(
  supabase: SupabaseClient,
  filter: AdminSupportCaseListFilter,
): Promise<SupportCaseRow[]> {
  const offset = filter.offset ?? 0
  const ascending = filter.order === "updated_asc" || filter.order === "created_asc"
  const orderCol = filter.order === "created_asc" ? "created_at" : "updated_at"

  const query = applyAdminCaseFilters(
    supabase.from("support_cases").select(CASE_SELECT),
    filter,
  )
  const { data, error } = await query
    .order(orderCol, { ascending })
    .range(offset, offset + filter.limit - 1)

  if (error) {
    console.warn("[support_cases] admin list skipped:", error.message)
    return []
  }
  return (data ?? []) as SupportCaseRow[]
}

export async function countSupportCasesAdminFiltered(
  supabase: SupabaseClient,
  filter: Omit<AdminSupportCaseListFilter, "limit" | "offset" | "order">,
): Promise<number> {
  const query = applyAdminCaseFilters(
    supabase.from("support_cases").select("id", { count: "exact", head: true }),
    filter,
  )
  const { count, error } = await query
  if (error) {
    console.warn("[support_cases] admin count skipped:", error.message)
    return 0
  }
  return count ?? 0
}

export async function listSupportCasesByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<SupportCaseRow[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from("support_cases")
    .select(CASE_SELECT)
    .in("id", ids)

  if (error) {
    console.warn("[support_cases] list by ids skipped:", error.message)
    return []
  }
  const byId = new Map((data ?? []).map((row) => [String((row as SupportCaseRow).id), row as SupportCaseRow]))
  return ids.map((id) => byId.get(id)).filter((row): row is SupportCaseRow => Boolean(row))
}

/** Case ids whose subject/preview/email/order/history match `query`. */
export async function searchSupportCaseIdsAdmin(
  supabase: SupabaseClient,
  query: string,
  limit = 80,
): Promise<string[]> {
  const q = query.trim()
  if (!q) return []

  const pattern = `%${escapeIlikePattern(q)}%`
  const caseOr = [
    `subject.ilike."${pattern}"`,
    `preview.ilike."${pattern}"`,
    `requester_email.ilike."${pattern}"`,
    `order_ref.ilike."${pattern}"`,
    `case_number.ilike."${pattern}"`,
  ].join(",")

  const lookups: Array<PromiseLike<{ data: Array<{ id?: string; case_id?: string }> | null }>> = [
    supabase
      .from("support_cases")
      .select("id")
      .or(caseOr)
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase.from("support_case_messages").select("case_id").ilike("body", pattern).limit(limit),
  ]

  if (UUID_RE.test(q)) {
    lookups.push(
      supabase
        .from("support_cases")
        .select("id")
        .or(`id.eq.${q},contact_message_id.eq.${q},order_support_request_id.eq.${q},order_id.eq.${q}`)
        .limit(8),
    )
  }

  const results = await Promise.all(lookups)
  const ids: string[] = []
  const seen = new Set<string>()
  for (const result of results) {
    for (const raw of result.data ?? []) {
      const id = String(raw.id ?? raw.case_id ?? "")
      if (!id || seen.has(id)) continue
      seen.add(id)
      ids.push(id)
      if (ids.length >= limit) return ids
    }
  }
  return ids
}

export async function getSupportCaseByOrderSupportId(
  supabase: SupabaseClient,
  orderSupportRequestId: string,
): Promise<SupportCaseRow | null> {
  const { data, error } = await supabase
    .from("support_cases")
    .select(CASE_SELECT)
    .eq("order_support_request_id", orderSupportRequestId)
    .maybeSingle()
  if (error || !data) return null
  return data as SupportCaseRow
}

export async function getOpenSellerSupportCaseForOrder(
  supabase: SupabaseClient,
  orderId: string,
  sellerId: string,
): Promise<SupportCaseRow | null> {
  const { data, error } = await supabase
    .from("support_cases")
    .select(CASE_SELECT)
    .eq("order_id", orderId)
    .eq("requester_user_id", sellerId)
    .eq("requester_role", "seller")
    .neq("status", "resolved")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as SupportCaseRow
}

export async function getSupportCaseByContactMessageId(
  supabase: SupabaseClient,
  contactMessageId: string,
): Promise<SupportCaseRow | null> {
  const { data, error } = await supabase
    .from("support_cases")
    .select(CASE_SELECT)
    .eq("contact_message_id", contactMessageId)
    .maybeSingle()
  if (error || !data) return null
  return data as SupportCaseRow
}
