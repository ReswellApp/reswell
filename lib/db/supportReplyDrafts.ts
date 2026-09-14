import type { SupabaseClient } from "@supabase/supabase-js"
import type { SupportCaseKind, SupportCaseStatus } from "@/lib/types/supportCase"
import type { SupportReplyDraftRow, SupportReplyExampleRow } from "@/lib/types/supportReplyDraft"
import type { SupportReplyDraftOrigin, SupportReplyDraftRating } from "@/lib/validations/supportReplyDraft"

const DRAFT_SELECT =
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
}

export type ResolvedCaseForRetrieval = {
  id: string
  kind: SupportCaseKind
  subject: string
  preview: string
  status: SupportCaseStatus
}

export async function getSupportReplyDraftByCaseId(
  supabase: SupabaseClient,
  caseId: string,
): Promise<SupportReplyDraftRow | null> {
  const { data, error } = await supabase
    .from("support_reply_drafts")
    .select(DRAFT_SELECT)
    .eq("case_id", caseId)
    .maybeSingle()
  if (error) {
    console.warn("[support_reply_drafts] get skipped:", error.message)
    return null
  }
  return (data as SupportReplyDraftRow | null) ?? null
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
  },
): Promise<SupportReplyDraftRow | null> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("support_reply_drafts")
    .upsert(
      {
        case_id: row.caseId,
        body: row.body,
        model: row.model,
        prompt_version: row.promptVersion,
        source_fingerprint: row.sourceFingerprint,
        cited_help_slugs: row.citedHelpSlugs,
        retrieved_example_ids: row.retrievedExampleIds,
        origin: row.origin,
        updated_at: now,
      },
      { onConflict: "case_id" },
    )
    .select(DRAFT_SELECT)
    .single()

  if (error) {
    console.warn("[support_reply_drafts] upsert skipped:", error.message)
    return null
  }
  return data as SupportReplyDraftRow
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

export async function getSupportReplyOrderSnapshot(
  supabase: SupabaseClient,
  orderId: string,
): Promise<SupportReplyOrderSnapshot | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_num, status, amount, fulfillment_method, delivery_status, tracking_number, tracking_carrier, carrier_delivered_at",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error || !data) return null
  const row = data as {
    id: string
    order_num: string | null
    status: string
    amount: number | null
    fulfillment_method: string | null
    delivery_status: string | null
    tracking_number: string | null
    tracking_carrier: string | null
    carrier_delivered_at: string | null
  }
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
  }
}
