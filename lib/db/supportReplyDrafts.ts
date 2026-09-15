import type { SupabaseClient } from "@supabase/supabase-js"
import type { SupportCaseKind, SupportCaseStatus } from "@/lib/types/supportCase"
import type {
  SupportReplyDraftCitations,
  SupportReplyDraftRow,
  SupportReplyExampleRow,
} from "@/lib/types/supportReplyDraft"
import { supportReplyExampleSearchOrClause } from "@/lib/utils/support-reply-examples"
import type { SupportReplyDraftOrigin, SupportReplyDraftRating } from "@/lib/validations/supportReplyDraft"

const DRAFT_SELECT =
  "id, case_id, body, model, prompt_version, source_fingerprint, cited_help_slugs, retrieved_example_ids, origin, reason, citations, created_at, updated_at"

const DRAFT_SELECT_LEGACY =
  "id, case_id, body, model, prompt_version, source_fingerprint, cited_help_slugs, retrieved_example_ids, origin, created_at, updated_at"

const EXAMPLE_SELECT =
  "id, case_id, kind, customer_excerpt, staff_reply, cited_help_slugs, rating, draft_id, rated_by, created_at"

export type SupportReplyOrderSnapshot = {
  id: string
  orderNum: string | null
  status: string
  amount: number
  fulfillmentMethod: string | null
  deliveryStatus: string | null
  trackingNumber: string | null
  trackingCarrier: string | null
  carrierDeliveredAt: string | null
  paymentMethod: string | null
  buyerId: string | null
  sellerId: string | null
}

export type ResolvedCaseForRetrieval = {
  id: string
  kind: SupportCaseKind
  subject: string
  preview: string
  status: SupportCaseStatus
}

function emptyCitations(): SupportReplyDraftCitations {
  return { orders: [], tickets: [] }
}

function parseCitations(raw: unknown): SupportReplyDraftCitations {
  if (!raw || typeof raw !== "object") return emptyCitations()
  const value = raw as { orders?: unknown; tickets?: unknown }
  const orders = Array.isArray(value.orders)
    ? value.orders.flatMap((item) => {
        if (!item || typeof item !== "object") return []
        const row = item as { id?: unknown; orderRef?: unknown }
        if (typeof row.id !== "string" || typeof row.orderRef !== "string") return []
        return [{ id: row.id, orderRef: row.orderRef }]
      })
    : []
  const tickets = Array.isArray(value.tickets)
    ? value.tickets.flatMap((item) => {
        if (!item || typeof item !== "object") return []
        const row = item as { id?: unknown; subject?: unknown; href?: unknown }
        if (typeof row.id !== "string" || typeof row.subject !== "string") return []
        return [
          {
            id: row.id,
            subject: row.subject,
            href: typeof row.href === "string" ? row.href : "",
          },
        ]
      })
    : []
  return { orders, tickets }
}

function toDraftRow(data: Record<string, unknown>): SupportReplyDraftRow {
  return {
    id: String(data.id),
    case_id: String(data.case_id),
    body: String(data.body ?? ""),
    model: typeof data.model === "string" ? data.model : null,
    prompt_version: String(data.prompt_version ?? ""),
    source_fingerprint: String(data.source_fingerprint ?? ""),
    cited_help_slugs: Array.isArray(data.cited_help_slugs)
      ? data.cited_help_slugs.filter((slug): slug is string => typeof slug === "string")
      : [],
    retrieved_example_ids: Array.isArray(data.retrieved_example_ids)
      ? data.retrieved_example_ids.filter((id): id is string => typeof id === "string")
      : [],
    origin: data.origin as SupportReplyDraftRow["origin"],
    reason: typeof data.reason === "string" && data.reason.trim() ? data.reason : null,
    citations: parseCitations(data.citations),
    created_at: String(data.created_at ?? ""),
    updated_at: String(data.updated_at ?? ""),
  }
}

function isMissingHarnessColumn(message: string): boolean {
  return (
    message.includes("reason") ||
    message.includes("citations") ||
    message.includes("Could not find the") ||
    message.includes("schema cache")
  )
}

export async function getSupportReplyDraftByCaseId(
  supabase: SupabaseClient,
  caseId: string,
): Promise<SupportReplyDraftRow | null> {
  const first = await supabase
    .from("support_reply_drafts")
    .select(DRAFT_SELECT)
    .eq("case_id", caseId)
    .maybeSingle()
  if (!first.error) {
    return first.data ? toDraftRow(first.data as Record<string, unknown>) : null
  }
  if (!isMissingHarnessColumn(first.error.message)) {
    console.warn("[support_reply_drafts] get skipped:", first.error.message)
    return null
  }
  const fallback = await supabase
    .from("support_reply_drafts")
    .select(DRAFT_SELECT_LEGACY)
    .eq("case_id", caseId)
    .maybeSingle()
  if (fallback.error || !fallback.data) {
    if (fallback.error) console.warn("[support_reply_drafts] get skipped:", fallback.error.message)
    return null
  }
  return toDraftRow(fallback.data as Record<string, unknown>)
}

export async function upsertSupportReplyDraft(
  supabase: SupabaseClient,
  row: {
    caseId: string
    body: string
    model: string | null
    promptVersion: string
    sourceFingerprint: string
    citedHelpSlugs: string[]
    retrievedExampleIds: string[]
    origin: SupportReplyDraftOrigin
    reason?: string | null
    citations?: SupportReplyDraftCitations
  },
): Promise<SupportReplyDraftRow | null> {
  const now = new Date().toISOString()
  const payload = {
    case_id: row.caseId,
    body: row.body,
    model: row.model,
    prompt_version: row.promptVersion,
    source_fingerprint: row.sourceFingerprint,
    cited_help_slugs: row.citedHelpSlugs,
    retrieved_example_ids: row.retrievedExampleIds,
    origin: row.origin,
    reason: row.reason ?? null,
    citations: row.citations ?? emptyCitations(),
    updated_at: now,
  }
  const first = await supabase
    .from("support_reply_drafts")
    .upsert(payload, { onConflict: "case_id" })
    .select(DRAFT_SELECT)
    .single()

  if (!first.error) return toDraftRow(first.data as Record<string, unknown>)

  if (!isMissingHarnessColumn(first.error.message)) {
    console.warn("[support_reply_drafts] upsert skipped:", first.error.message)
    return null
  }

  const legacy = {
    case_id: payload.case_id,
    body: payload.body,
    model: payload.model,
    prompt_version: payload.prompt_version,
    source_fingerprint: payload.source_fingerprint,
    cited_help_slugs: payload.cited_help_slugs,
    retrieved_example_ids: payload.retrieved_example_ids,
    origin: payload.origin,
    updated_at: payload.updated_at,
  }
  const fallback = await supabase
    .from("support_reply_drafts")
    .upsert(legacy, { onConflict: "case_id" })
    .select(DRAFT_SELECT_LEGACY)
    .single()
  if (fallback.error || !fallback.data) {
    if (fallback.error) console.warn("[support_reply_drafts] upsert skipped:", fallback.error.message)
    return null
  }
  return {
    ...toDraftRow(fallback.data as Record<string, unknown>),
    reason: row.reason ?? null,
    citations: row.citations ?? emptyCitations(),
  }
}

export async function listSupportReplyExamples(
  supabase: SupabaseClient,
  limit = 80,
): Promise<SupportReplyExampleRow[]> {
  const { data, error } = await supabase
    .from("support_reply_examples")
    .select(EXAMPLE_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.warn("[support_reply_examples] list skipped:", error.message)
    return []
  }
  return (data ?? []) as SupportReplyExampleRow[]
}

export type SupportReplyExampleListFilters = {
  rating?: SupportReplyDraftRating
  kind?: string
  q?: string
}

export async function listSupportReplyExamplesPage(
  supabase: SupabaseClient,
  filters: SupportReplyExampleListFilters & { offset: number; limit: number },
): Promise<{ rows: SupportReplyExampleRow[]; total: number } | { error: string }> {
  let query = supabase
    .from("support_reply_examples")
    .select(EXAMPLE_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1)

  if (filters.rating) query = query.eq("rating", filters.rating)
  if (filters.kind) query = query.eq("kind", filters.kind)
  const search = supportReplyExampleSearchOrClause(filters.q)
  if (search) query = query.or(search)

  const { data, error, count } = await query
  if (error) {
    console.error("[support_reply_examples] list failed:", error.message)
    return { error: "Could not load reply examples." }
  }
  return { rows: (data ?? []) as SupportReplyExampleRow[], total: count ?? 0 }
}

export async function countSupportReplyExamples(
  supabase: SupabaseClient,
  filters: SupportReplyExampleListFilters = {},
): Promise<number> {
  let query = supabase.from("support_reply_examples").select("id", { count: "exact", head: true })
  if (filters.rating) query = query.eq("rating", filters.rating)
  if (filters.kind) query = query.eq("kind", filters.kind)
  const search = supportReplyExampleSearchOrClause(filters.q)
  if (search) query = query.or(search)

  const { count, error } = await query
  if (error) {
    console.warn("[support_reply_examples] count skipped:", error.message)
    return 0
  }
  return count ?? 0
}

export async function getSupportReplyExampleById(
  supabase: SupabaseClient,
  id: string,
): Promise<SupportReplyExampleRow | null> {
  const { data, error } = await supabase
    .from("support_reply_examples")
    .select(EXAMPLE_SELECT)
    .eq("id", id)
    .maybeSingle()
  if (error) {
    console.warn("[support_reply_examples] get skipped:", error.message)
    return null
  }
  return (data as SupportReplyExampleRow | null) ?? null
}

export async function updateSupportReplyExample(
  supabase: SupabaseClient,
  row: {
    id: string
    customerExcerpt: string
    staffReply: string
    citedHelpSlugs: string[]
    rating: SupportReplyDraftRating
    kind: string | null
  },
): Promise<SupportReplyExampleRow | { error: string }> {
  const { data, error } = await supabase
    .from("support_reply_examples")
    .update({
      customer_excerpt: row.customerExcerpt.slice(0, 4000),
      staff_reply: row.staffReply.slice(0, 12000),
      cited_help_slugs: row.citedHelpSlugs,
      rating: row.rating,
      kind: row.kind,
    })
    .eq("id", row.id)
    .select(EXAMPLE_SELECT)
    .single()

  if (error || !data) {
    console.error("[support_reply_examples] update failed:", error?.message)
    return { error: "Could not save that example." }
  }
  return data as SupportReplyExampleRow
}

export async function deleteSupportReplyExample(
  supabase: SupabaseClient,
  id: string,
): Promise<{ success: true } | { error: string }> {
  const { error } = await supabase.from("support_reply_examples").delete().eq("id", id)
  if (error) {
    console.error("[support_reply_examples] delete failed:", error.message)
    return { error: "Could not delete that example." }
  }
  return { success: true }
}

export async function insertSupportReplyExample(
  supabase: SupabaseClient,
  row: {
    caseId: string
    kind: string | null
    customerExcerpt: string
    staffReply: string
    citedHelpSlugs: string[]
    rating: SupportReplyDraftRating
    draftId?: string | null
    ratedBy?: string | null
  },
): Promise<void> {
  const { error } = await supabase.from("support_reply_examples").insert({
    case_id: row.caseId,
    kind: row.kind,
    customer_excerpt: row.customerExcerpt.slice(0, 4000),
    staff_reply: row.staffReply.slice(0, 12000),
    cited_help_slugs: row.citedHelpSlugs,
    rating: row.rating,
    draft_id: row.draftId ?? null,
    rated_by: row.ratedBy ?? null,
  })
  if (error) {
    console.warn("[support_reply_examples] insert skipped:", error.message)
  }
}

export async function listResolvedCasesForRetrieval(
  supabase: SupabaseClient,
  args: { kind?: string; excludeId?: string; limit?: number },
): Promise<ResolvedCaseForRetrieval[]> {
  let query = supabase
    .from("support_cases")
    .select("id, kind, subject, preview, status")
    .eq("status", "resolved")
    .order("updated_at", { ascending: false })
    .limit(args.limit ?? 80)

  if (args.kind) query = query.eq("kind", args.kind)
  if (args.excludeId) query = query.neq("id", args.excludeId)

  const { data, error } = await query
  if (error) {
    console.warn("[support_cases] retrieval list skipped:", error.message)
    return []
  }
  return (data ?? []) as ResolvedCaseForRetrieval[]
}

export async function listAgentRepliesForCases(
  supabase: SupabaseClient,
  caseIds: string[],
): Promise<Array<{ case_id: string; body: string; created_at: string }>> {
  if (caseIds.length === 0) return []
  const { data, error } = await supabase
    .from("support_case_messages")
    .select("case_id, body, created_at")
    .in("case_id", caseIds)
    .eq("author_role", "agent")
    .eq("is_internal", false)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    console.warn("[support_case_messages] retrieval replies skipped:", error.message)
    return []
  }
  return (data ?? []) as Array<{ case_id: string; body: string; created_at: string }>
}

export async function listOpenCaseIdsNeedingDraft(
  supabase: SupabaseClient,
  limit = 20,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("support_cases")
    .select("id, status")
    .neq("status", "resolved")
    .order("updated_at", { ascending: false })
    .limit(80)

  if (error) {
    console.warn("[support_cases] open draft queue skipped:", error.message)
    return []
  }

  const ids = (data ?? []).map((row) => String((row as { id: string }).id))
  if (ids.length === 0) return []

  const { data: drafts, error: draftError } = await supabase
    .from("support_reply_drafts")
    .select("case_id")
    .in("case_id", ids)

  if (draftError) {
    console.warn("[support_reply_drafts] queue lookup skipped:", draftError.message)
    return ids.slice(0, limit)
  }

  const have = new Set((drafts ?? []).map((row) => String((row as { case_id: string }).case_id)))
  return ids.filter((id) => !have.has(id)).slice(0, limit)
}

export async function getSupportReplyRequesterNames(
  supabase: SupabaseClient,
  row: { contact_message_id: string | null; requester_user_id: string | null },
): Promise<{ contactName: string | null; displayName: string | null }> {
  const [contact, profile] = await Promise.all([
    row.contact_message_id
      ? supabase
          .from("contact_messages")
          .select("name")
          .eq("id", row.contact_message_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    row.requester_user_id
      ? supabase
          .from("profiles")
          .select("display_name")
          .eq("id", row.requester_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const contactName =
    contact.data && typeof (contact.data as { name?: unknown }).name === "string"
      ? (contact.data as { name: string }).name
      : null
  const displayName =
    profile.data && typeof (profile.data as { display_name?: unknown }).display_name === "string"
      ? (profile.data as { display_name: string }).display_name
      : null
  return { contactName, displayName }
}

const ORDER_SNAPSHOT_SELECT =
  "id, order_num, status, amount, fulfillment_method, delivery_status, tracking_number, tracking_carrier, carrier_delivered_at, payment_method, buyer_id, seller_id"

function toOrderSnapshot(row: {
  id: string
  order_num: string | null
  status: string
  amount: number | null
  fulfillment_method: string | null
  delivery_status: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  carrier_delivered_at: string | null
  payment_method?: string | null
  buyer_id?: string | null
  seller_id?: string | null
}): SupportReplyOrderSnapshot {
  return {
    id: row.id,
    orderNum: row.order_num,
    status: row.status,
    amount: Number(row.amount ?? 0),
    fulfillmentMethod: row.fulfillment_method,
    deliveryStatus: row.delivery_status,
    trackingNumber: row.tracking_number,
    trackingCarrier: row.tracking_carrier,
    carrierDeliveredAt: row.carrier_delivered_at,
    paymentMethod: row.payment_method ?? null,
    buyerId: row.buyer_id ?? null,
    sellerId: row.seller_id ?? null,
  }
}

export async function getSupportReplyOrderSnapshot(
  supabase: SupabaseClient,
  orderId: string,
): Promise<SupportReplyOrderSnapshot | null> {
  return findSupportReplyOrderSnapshot(supabase, { id: orderId })
}

export async function findSupportReplyOrderSnapshot(
  supabase: SupabaseClient,
  query: { id?: string; orderNum?: string },
): Promise<SupportReplyOrderSnapshot | null> {
  let builder = supabase.from("orders").select(ORDER_SNAPSHOT_SELECT)
  if (query.id) builder = builder.eq("id", query.id)
  else if (query.orderNum) builder = builder.ilike("order_num", query.orderNum.trim())
  else return null

  const { data, error } = await builder.maybeSingle()
  if (error || !data) return null
  return toOrderSnapshot(data as Parameters<typeof toOrderSnapshot>[0])
}

export async function listSupportReplyOrdersForCustomer(
  supabase: SupabaseClient,
  userId: string,
  limit = 40,
): Promise<SupportReplyOrderSnapshot[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SNAPSHOT_SELECT)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error || !data) {
    if (error) console.warn("[support_reply_drafts] customer orders skipped:", error.message)
    return []
  }
  return (data as Parameters<typeof toOrderSnapshot>[0][]).map(toOrderSnapshot)
}
