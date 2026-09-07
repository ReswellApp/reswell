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
  "id, case_number, kind, status, priority, subject, preview, requester_user_id, requester_email, requester_role, order_id, order_ref, listing_id, conversation_id, contact_message_id, order_support_request_id, assignee_admin_id, sla_due_at, outcome, internal_notes, source_channel, created_at, updated_at, resolved_at"

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
    conversation_id?: string | null
    contact_message_id?: string | null
    order_support_request_id?: string | null
    source_channel: string
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
      conversation_id: row.conversation_id ?? null,
      contact_message_id: row.contact_message_id ?? null,
      order_support_request_id: row.order_support_request_id ?? null,
      source_channel: row.source_channel,
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

export async function insertSupportCaseMessage(
  supabase: SupabaseClient,
  row: {
    case_id: string
    author_user_id?: string | null
    author_role: "customer" | "agent" | "system"
    body: string
    is_internal?: boolean
  },
): Promise<{ id: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("support_case_messages")
    .insert({
      case_id: row.case_id,
      author_user_id: row.author_user_id ?? null,
      author_role: row.author_role,
      body: row.body,
      is_internal: row.is_internal ?? false,
    })
    .select("id")
    .single()
  if (error) {
    console.warn("[support_case_messages] insert skipped:", error.message)
    return { id: null, error: new Error(error.message) }
  }
  return { id: data?.id ? String(data.id) : null, error: null }
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
    if (args.status === "resolved") patch.resolved_at = new Date().toISOString()
  }
  if (args.assignee_admin_id !== undefined) patch.assignee_admin_id = args.assignee_admin_id
  if (args.internal_notes !== undefined) patch.internal_notes = args.internal_notes
  if (args.outcome !== undefined) patch.outcome = args.outcome
  if (args.priority !== undefined) patch.priority = args.priority

  const { error } = await supabase.from("support_cases").update(patch).eq("id", args.id)
  if (error) return { error: new Error(error.message) }
  return { error: null }
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

export async function listSupportCasesAdmin(
  supabase: SupabaseClient,
  limit = 200,
): Promise<SupportCaseRow[]> {
  const { data, error } = await supabase
    .from("support_cases")
    .select(CASE_SELECT)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.warn("[support_cases] admin list skipped:", error.message)
    return []
  }
  return (data ?? []) as SupportCaseRow[]
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
