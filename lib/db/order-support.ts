import type { SupabaseClient } from "@supabase/supabase-js"
import type { CarrierClaimStatus } from "@/lib/types/protectionClaimDesk"

export type OrderSupportRequestType = "help" | "cancel_order" | "refund_help"

export type OrderSupportStatus =
  | "new"
  | "triaged"
  | "waiting_on_customer"
  | "investigating"
  | "resolved"
  | "closed"

export type OrderSupportRequesterRole = "buyer" | "seller"

export type OrderSupportOutcome =
  | "approved"
  | "partial"
  | "denied"
  | "withdrawn"
  | "cancelled"
  | "informed"

export type OrderSupportRequestRow = {
  id: string
  order_id: string
  buyer_id: string
  request_type: string
  body: string
  contacted_seller_first: boolean | null
  order_ref: string
  created_at: string
  support_status: OrderSupportStatus
  requester_role: OrderSupportRequesterRole
  assignee_admin_id: string | null
  internal_notes: string | null
  outcome: OrderSupportOutcome | null
  updated_at: string
  support_conversation_id: string | null
  carrier_claim_status: CarrierClaimStatus | null
  carrier_claim_id: string | null
  carrier_claim_url: string | null
  insurance_claim_url: string | null
  repair_credit_total: number
  repair_credit_last_at: string | null
}

export const ORDER_SUPPORT_SELECT =
  "id, order_id, buyer_id, request_type, body, contacted_seller_first, order_ref, created_at, support_status, requester_role, assignee_admin_id, internal_notes, outcome, updated_at, support_conversation_id, carrier_claim_status, carrier_claim_id, carrier_claim_url, insurance_claim_url, repair_credit_total, repair_credit_last_at"

export const ORDER_SUPPORT_USER_SELECT =
  "id, order_id, buyer_id, request_type, body, contacted_seller_first, order_ref, created_at, support_status, requester_role, updated_at, support_conversation_id, repair_credit_total, repair_credit_last_at"

export type OrderSupportUserRow = Omit<
  OrderSupportRequestRow,
  | "assignee_admin_id"
  | "internal_notes"
  | "outcome"
  | "carrier_claim_status"
  | "carrier_claim_id"
  | "carrier_claim_url"
  | "insurance_claim_url"
>

function asStatus(raw: unknown): OrderSupportStatus {
  const v = String(raw ?? "new")
  if (
    v === "triaged" ||
    v === "waiting_on_customer" ||
    v === "investigating" ||
    v === "resolved" ||
    v === "closed"
  ) {
    return v
  }
  return "new"
}

function asRole(raw: unknown): OrderSupportRequesterRole {
  return raw === "seller" ? "seller" : "buyer"
}

function asCarrierClaimStatus(raw: unknown): CarrierClaimStatus | null {
  const v = typeof raw === "string" ? raw : ""
  if (
    v === "not_started" ||
    v === "ready_to_file" ||
    v === "filed" ||
    v === "under_review" ||
    v === "approved" ||
    v === "denied" ||
    v === "paid" ||
    v === "withdrawn"
  ) {
    return v
  }
  return null
}

export function normalizeOrderSupportRow(raw: Record<string, unknown>): OrderSupportRequestRow {
  const creditRaw = raw.repair_credit_total
  const creditNum =
    creditRaw == null || creditRaw === ""
      ? 0
      : typeof creditRaw === "number"
        ? creditRaw
        : parseFloat(String(creditRaw))
  return {
    id: String(raw.id),
    order_id: String(raw.order_id),
    buyer_id: String(raw.buyer_id),
    request_type: String(raw.request_type ?? "help"),
    body: String(raw.body ?? ""),
    contacted_seller_first:
      raw.contacted_seller_first == null ? null : Boolean(raw.contacted_seller_first),
    order_ref: String(raw.order_ref ?? ""),
    created_at: String(raw.created_at ?? ""),
    support_status: asStatus(raw.support_status),
    requester_role: asRole(raw.requester_role),
    assignee_admin_id: raw.assignee_admin_id == null ? null : String(raw.assignee_admin_id),
    internal_notes: raw.internal_notes == null ? null : String(raw.internal_notes),
    outcome: (raw.outcome as OrderSupportOutcome | null) ?? null,
    updated_at: String(raw.updated_at ?? raw.created_at ?? ""),
    support_conversation_id:
      raw.support_conversation_id == null ? null : String(raw.support_conversation_id),
    carrier_claim_status: asCarrierClaimStatus(raw.carrier_claim_status),
    carrier_claim_id: raw.carrier_claim_id == null ? null : String(raw.carrier_claim_id),
    carrier_claim_url: raw.carrier_claim_url == null ? null : String(raw.carrier_claim_url),
    insurance_claim_url: raw.insurance_claim_url == null ? null : String(raw.insurance_claim_url),
    repair_credit_total: Number.isFinite(creditNum) ? creditNum : 0,
    repair_credit_last_at:
      raw.repair_credit_last_at == null ? null : String(raw.repair_credit_last_at),
  }
}

function normalizeOrderSupportUserRow(raw: Record<string, unknown>): OrderSupportUserRow {
  const row = normalizeOrderSupportRow(raw)
  return {
    id: row.id,
    order_id: row.order_id,
    buyer_id: row.buyer_id,
    request_type: row.request_type,
    body: row.body,
    contacted_seller_first: row.contacted_seller_first,
    order_ref: row.order_ref,
    created_at: row.created_at,
    support_status: row.support_status,
    requester_role: row.requester_role,
    updated_at: row.updated_at,
    support_conversation_id: row.support_conversation_id,
    repair_credit_total: row.repair_credit_total,
    repair_credit_last_at: row.repair_credit_last_at,
  }
}

export async function insertOrderSupportRequest(
  supabase: SupabaseClient,
  row: {
    order_id: string
    buyer_id: string
    request_type: OrderSupportRequestType
    body: string
    contacted_seller_first: boolean | null
    order_ref: string
    requester_role?: OrderSupportRequesterRole
  },
): Promise<{ data: OrderSupportRequestRow | null; error: Error | null }> {
  const withLifecycle = {
    order_id: row.order_id,
    buyer_id: row.buyer_id,
    request_type: row.request_type,
    body: row.body,
    contacted_seller_first: row.contacted_seller_first,
    order_ref: row.order_ref,
    requester_role: row.requester_role ?? "buyer",
    support_status: "new" as const,
  }

  const { data, error } = await supabase
    .from("order_support_requests")
    .insert(withLifecycle)
    .select(ORDER_SUPPORT_SELECT)
    .single()

  if (!error && data) {
    return { data: normalizeOrderSupportRow(data as Record<string, unknown>), error: null }
  }

  // Pre-migration: columns may not exist yet
  const legacy = await supabase
    .from("order_support_requests")
    .insert({
      order_id: row.order_id,
      buyer_id: row.buyer_id,
      request_type: row.request_type,
      body: row.body,
      contacted_seller_first: row.contacted_seller_first,
      order_ref: row.order_ref,
    })
    .select(
      "id, order_id, buyer_id, request_type, body, contacted_seller_first, order_ref, created_at",
    )
    .single()

  if (legacy.error || !legacy.data) {
    return { data: null, error: new Error(legacy.error?.message ?? error?.message ?? "Insert failed") }
  }

  return {
    data: normalizeOrderSupportRow({
      ...(legacy.data as Record<string, unknown>),
      support_status: "new",
      requester_role: row.requester_role ?? "buyer",
      assignee_admin_id: null,
      internal_notes: null,
      outcome: null,
      updated_at: (legacy.data as { created_at: string }).created_at,
    }),
    error: null,
  }
}

export async function listOrderSupportRequestsForUser(
  supabase: SupabaseClient,
  userId: string,
  filter: "all" | "open" | "resolved" = "all",
): Promise<OrderSupportUserRow[]> {
  let query = supabase
    .from("order_support_requests")
    .select(ORDER_SUPPORT_USER_SELECT)
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (filter === "open") {
    query = query.not("support_status", "in", '("resolved","closed")')
  } else if (filter === "resolved") {
    query = query.in("support_status", ["resolved", "closed"])
  }

  const { data, error } = await query
  if (error) {
    // Pre-migration deployments may lack new columns — fall back to legacy select.
    console.error("listOrderSupportRequestsForUser", error)
    const legacy = await supabase
      .from("order_support_requests")
      .select(
        "id, order_id, buyer_id, request_type, body, contacted_seller_first, order_ref, created_at",
      )
      .eq("buyer_id", userId)
      .order("created_at", { ascending: false })
      .limit(100)

    if (legacy.error || !legacy.data) return []
    return legacy.data.map((row) =>
      normalizeOrderSupportUserRow({
        ...(row as Record<string, unknown>),
        support_status: "new",
        requester_role: "buyer",
        updated_at: (row as { created_at: string }).created_at,
      }),
    )
  }

  return (data ?? []).map((row) => normalizeOrderSupportUserRow(row as Record<string, unknown>))
}

export async function getOrderSupportRequestForUser(
  supabase: SupabaseClient,
  userId: string,
  requestId: string,
): Promise<OrderSupportUserRow | null> {
  const { data, error } = await supabase
    .from("order_support_requests")
    .select(ORDER_SUPPORT_USER_SELECT)
    .eq("id", requestId)
    .eq("buyer_id", userId)
    .maybeSingle()

  if (error || !data) {
    // Legacy fallback
    const legacy = await supabase
      .from("order_support_requests")
      .select(
        "id, order_id, buyer_id, request_type, body, contacted_seller_first, order_ref, created_at",
      )
      .eq("id", requestId)
      .eq("buyer_id", userId)
      .maybeSingle()
    if (legacy.error || !legacy.data) return null
    return normalizeOrderSupportUserRow({
      ...(legacy.data as Record<string, unknown>),
      support_status: "new",
      requester_role: "buyer",
      updated_at: (legacy.data as { created_at: string }).created_at,
    })
  }

  return normalizeOrderSupportUserRow(data as Record<string, unknown>)
}

export async function countOpenOrderSupportForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("order_support_requests")
    .select("id", { count: "exact", head: true })
    .eq("buyer_id", userId)
    .not("support_status", "in", '("resolved","closed")')

  if (error) {
    // If status column missing, treat all as open for count purposes
    const legacy = await supabase
      .from("order_support_requests")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", userId)
    return legacy.count ?? 0
  }
  return count ?? 0
}

export async function updateOrderSupportRequestAdmin(
  supabase: SupabaseClient,
  args: {
    id: string
    support_status?: OrderSupportStatus
    internal_notes?: string | null
    assignee_admin_id?: string | null
    outcome?: OrderSupportOutcome | null
    support_conversation_id?: string | null
    carrier_claim_status?: CarrierClaimStatus | null
    carrier_claim_id?: string | null
    carrier_claim_url?: string | null
    insurance_claim_url?: string | null
    repair_credit_total?: number
    repair_credit_last_at?: string | null
  },
): Promise<{ error: Error | null }> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (args.support_status !== undefined) patch.support_status = args.support_status
  if (args.internal_notes !== undefined) patch.internal_notes = args.internal_notes
  if (args.assignee_admin_id !== undefined) patch.assignee_admin_id = args.assignee_admin_id
  if (args.outcome !== undefined) patch.outcome = args.outcome
  if (args.support_conversation_id !== undefined) {
    patch.support_conversation_id = args.support_conversation_id
  }
  if (args.carrier_claim_status !== undefined) {
    patch.carrier_claim_status = args.carrier_claim_status
  }
  if (args.carrier_claim_id !== undefined) patch.carrier_claim_id = args.carrier_claim_id
  if (args.carrier_claim_url !== undefined) patch.carrier_claim_url = args.carrier_claim_url
  if (args.insurance_claim_url !== undefined) {
    patch.insurance_claim_url = args.insurance_claim_url
  }
  if (args.repair_credit_total !== undefined) {
    patch.repair_credit_total = args.repair_credit_total
  }
  if (args.repair_credit_last_at !== undefined) {
    patch.repair_credit_last_at = args.repair_credit_last_at
  }

  const { error } = await supabase.from("order_support_requests").update(patch).eq("id", args.id)
  if (error) return { error: new Error(error.message) }
  return { error: null }
}

export async function listOrderSupportRequestsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<OrderSupportRequestRow[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from("order_support_requests")
    .select(ORDER_SUPPORT_SELECT)
    .in("id", ids)
  if (error || !data) return []
  return data.map((row) => normalizeOrderSupportRow(row as Record<string, unknown>))
}

export async function getOrderSupportRequestById(
  supabase: SupabaseClient,
  id: string,
): Promise<OrderSupportRequestRow | null> {
  const { data, error } = await supabase
    .from("order_support_requests")
    .select(ORDER_SUPPORT_SELECT)
    .eq("id", id)
    .maybeSingle()

  if (error || !data) {
    const legacy = await supabase
      .from("order_support_requests")
      .select(
        "id, order_id, buyer_id, request_type, body, contacted_seller_first, order_ref, created_at",
      )
      .eq("id", id)
      .maybeSingle()
    if (legacy.error || !legacy.data) return null
    return normalizeOrderSupportRow({
      ...(legacy.data as Record<string, unknown>),
      support_status: "new",
      requester_role: "buyer",
      assignee_admin_id: null,
      internal_notes: null,
      outcome: null,
      updated_at: (legacy.data as { created_at: string }).created_at,
      support_conversation_id: null,
    })
  }

  return normalizeOrderSupportRow(data as Record<string, unknown>)
}

/** Latest order case linked to this support conversation (admin / redirect). */
export async function findOrderSupportMetaByConversationId(
  supabase: SupabaseClient,
  supportConversationId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("order_support_requests")
    .select("id")
    .eq("support_conversation_id", supportConversationId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return { id: String(data.id) }
}

/** Conversation ids linked to order help / claim cases (exclude from marketplace Messages). */
export async function listConversationIdsLinkedToOrderSupport(
  supabase: SupabaseClient,
  conversationIds: string[],
): Promise<Set<string>> {
  const unique = Array.from(new Set(conversationIds.filter(Boolean)))
  if (unique.length === 0) return new Set()

  const { data, error } = await supabase
    .from("order_support_requests")
    .select("support_conversation_id")
    .in("support_conversation_id", unique)

  if (error) {
    console.warn("[listConversationIdsLinkedToOrderSupport]", error.message)
    return new Set()
  }

  const linked = new Set<string>()
  for (const row of data ?? []) {
    if (row.support_conversation_id) linked.add(String(row.support_conversation_id))
  }
  return linked
}

export async function listOrderSupportRequestsAdmin(
  supabase: SupabaseClient,
  limit = 200,
): Promise<OrderSupportRequestRow[]> {
  const { data, error } = await supabase
    .from("order_support_requests")
    .select(ORDER_SUPPORT_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("listOrderSupportRequestsAdmin", error)
    const legacy = await supabase
      .from("order_support_requests")
      .select(
        "id, order_id, buyer_id, request_type, body, contacted_seller_first, order_ref, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit)
    if (legacy.error || !legacy.data) return []
    return legacy.data.map((row) =>
      normalizeOrderSupportRow({
        ...(row as Record<string, unknown>),
        support_status: "new",
        requester_role: "buyer",
        assignee_admin_id: null,
        internal_notes: null,
        outcome: null,
        updated_at: (row as { created_at: string }).created_at,
      }),
    )
  }

  return (data ?? []).map((row) => normalizeOrderSupportRow(row as Record<string, unknown>))
}
