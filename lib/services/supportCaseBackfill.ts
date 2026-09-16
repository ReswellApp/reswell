import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getSupportCaseByContactMessageId,
  getSupportCaseByOrderSupportId,
  insertSupportCase,
  insertSupportCaseMessage,
  listSupportCasesForRequester,
  type SupportCaseRow,
} from "@/lib/db/supportCases"
import { listContactMessagesForUser, normalizeContactMessageRow } from "@/lib/db/contactMessages"
import { listOrderSupportRequestsForUser, normalizeOrderSupportRow } from "@/lib/db/order-support"
import { orderRequestTypeSubject, orderRequestTypeToKind } from "@/lib/utils/support-case-display"
import { supportTicketDisplaySubject } from "@/lib/utils/support-ticket-display"
import type { SupportCaseKind } from "@/lib/types/supportCase"

/**
 * Create a support_cases row for a legacy ticket if one does not exist yet.
 * Safe to call for a single ticket. Inbox list must not scan/ensure in bulk.
 */
export async function ensureCaseForOrderSupport(
  supabase: SupabaseClient,
  row: {
    id: string
    request_type: string
    body: string
    buyer_id: string
    order_id: string
    order_ref: string
    requester_role: "buyer" | "seller"
  },
  email?: string | null,
): Promise<SupportCaseRow | null> {
  const existing = await getSupportCaseByOrderSupportId(supabase, row.id)
  if (existing) return existing

  const kind = orderRequestTypeToKind(row.request_type)
  const subject =
    row.requester_role === "seller"
      ? `[Seller] ${orderRequestTypeSubject(row.request_type, row.order_ref)}`
      : orderRequestTypeSubject(row.request_type, row.order_ref)

  const inserted = await insertSupportCase(supabase, {
    kind,
    subject,
    preview: row.body,
    requester_user_id: row.buyer_id,
    requester_email: email ?? null,
    requester_role: row.requester_role,
    order_id: row.order_id,
    order_ref: row.order_ref,
    order_support_request_id: row.id,
    source_channel: row.requester_role === "seller" ? "order_seller" : "order_buyer",
    priority: kind === "protection_claim" ? "high" : "normal",
  })
  if (!inserted.data) return null
  await insertSupportCaseMessage(supabase, {
    case_id: inserted.data.id,
    author_user_id: row.buyer_id,
    author_role: "customer",
    body: row.body,
  })
  return inserted.data
}

export async function ensureCaseForContactMessage(
  supabase: SupabaseClient,
  row: {
    id: string
    subject: string | null
    message: string
    email: string
    user_id: string | null
    source: string
  },
): Promise<SupportCaseRow | null> {
  const existing = await getSupportCaseByContactMessageId(supabase, row.id)
  if (existing) return existing

  const subject = supportTicketDisplaySubject(
    row.subject,
    row.source === "messages_support"
      ? "messages_support"
      : row.source === "live_chat"
        ? "live_chat"
        : "contact_form",
  )
  const kind: SupportCaseKind =
    subject.toLowerCase().includes("safety")
      ? "safety"
      : subject.toLowerCase().includes("payment")
        ? "payments"
        : subject.toLowerCase().includes("account")
          ? "account"
          : "general"

  const inserted = await insertSupportCase(supabase, {
    kind,
    subject,
    preview: row.message,
    requester_user_id: row.user_id,
    requester_email: row.email,
    requester_role: row.user_id ? "member" : "guest",
    contact_message_id: row.id,
    source_channel:
      row.source === "messages_support"
        ? "help_hub"
        : row.source === "live_chat"
          ? "live_chat"
          : "contact_form",
    priority: kind === "safety" ? "urgent" : "normal",
  })
  if (!inserted.data) return null
  await insertSupportCaseMessage(supabase, {
    case_id: inserted.data.id,
    author_user_id: row.user_id,
    author_role: "customer",
    body: row.message,
  })
  return inserted.data
}

/** Backfill this member’s legacy tickets so My Cases / deep links resolve. */
export async function backfillUserLegacyCases(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null,
): Promise<void> {
  const [tickets, orderRows, existing] = await Promise.all([
    listContactMessagesForUser(supabase, userId, "all"),
    listOrderSupportRequestsForUser(supabase, userId, "all"),
    listSupportCasesForRequester(supabase, userId, "all"),
  ])
  const haveContact = new Set(
    existing.map((row) => row.contact_message_id).filter((id): id is string => Boolean(id)),
  )
  const haveOrder = new Set(
    existing
      .map((row) => row.order_support_request_id)
      .filter((id): id is string => Boolean(id)),
  )
  await Promise.all([
    ...orderRows
      .filter((row) => !haveOrder.has(row.id))
      .map((row) =>
        ensureCaseForOrderSupport(
          supabase,
          {
            id: row.id,
            request_type: row.request_type,
            body: row.body,
            buyer_id: row.buyer_id,
            order_id: row.order_id,
            order_ref: row.order_ref,
            requester_role: row.requester_role,
          },
          email,
        ),
      ),
    ...tickets
      .filter((row) => !haveContact.has(row.id) && row.source !== "live_chat")
      .map((row) =>
        ensureCaseForContactMessage(supabase, {
          id: row.id,
          subject: row.subject,
          message: row.message,
          email: row.email,
          user_id: row.user_id,
          source: row.source,
        }),
      ),
  ])
}

export type LegacySupportCaseBackfillSummary = {
  scannedContact: number
  scannedOrder: number
  createdContact: number
  createdOrder: number
}

/**
 * Cron-only: copy recent legacy tickets into support_cases.
 * Do not call from the inbox list/GET path.
 */
export async function backfillRecentLegacySupportCases(
  supabase: SupabaseClient,
  limit = 400,
): Promise<LegacySupportCaseBackfillSummary> {
  const [cmRes, osRes] = await Promise.all([
    supabase
      .from("contact_messages")
      .select("id, name, email, subject, message, created_at, source, user_id")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("order_support_requests")
      .select("id, request_type, body, buyer_id, order_id, order_ref, requester_role")
      .order("created_at", { ascending: false })
      .limit(limit),
  ])

  const contactIds = (cmRes.data ?? []).map((raw) => String((raw as { id: string }).id))
  const orderIds = (osRes.data ?? []).map((raw) => String((raw as { id: string }).id))
  const [existingContact, existingOrder] = await Promise.all([
    contactIds.length > 0
      ? supabase.from("support_cases").select("contact_message_id").in("contact_message_id", contactIds)
      : Promise.resolve({ data: [] as Array<{ contact_message_id: string | null }> }),
    orderIds.length > 0
      ? supabase
          .from("support_cases")
          .select("order_support_request_id")
          .in("order_support_request_id", orderIds)
      : Promise.resolve({ data: [] as Array<{ order_support_request_id: string | null }> }),
  ])

  const haveContact = new Set(
    (existingContact.data ?? [])
      .map((row) => row.contact_message_id)
      .filter((id): id is string => Boolean(id)),
  )
  const haveOrder = new Set(
    (existingOrder.data ?? [])
      .map((row) => row.order_support_request_id)
      .filter((id): id is string => Boolean(id)),
  )

  const missingContact = (cmRes.data ?? []).filter((raw) => {
    const row = raw as { id: string; source?: string | null; subject?: string | null }
    return !haveContact.has(String(row.id))
  })
  const missingOrder = (osRes.data ?? []).filter(
    (raw) => !haveOrder.has(String((raw as { id: string }).id)),
  )

  const contactResults = await Promise.all(
    missingContact.map((raw) => {
      const row = normalizeContactMessageRow({
        ...(raw as Record<string, unknown>),
        support_status: "new",
        internal_notes: null,
        updated_at: (raw as { created_at: string }).created_at,
      })
      return ensureCaseForContactMessage(supabase, {
        id: row.id,
        subject: row.subject,
        message: row.message,
        email: row.email,
        user_id: row.user_id,
        source: row.source,
      })
    }),
  )
  const orderResults = await Promise.all(
    missingOrder.map((raw) => {
      const row = normalizeOrderSupportRow({
        ...(raw as Record<string, unknown>),
        support_status: "new",
        assignee_admin_id: null,
        internal_notes: null,
        outcome: null,
        updated_at: new Date().toISOString(),
      })
      return ensureCaseForOrderSupport(supabase, {
        id: row.id,
        request_type: row.request_type,
        body: row.body,
        buyer_id: row.buyer_id,
        order_id: row.order_id,
        order_ref: row.order_ref,
        requester_role: row.requester_role,
      })
    }),
  )

  return {
    scannedContact: (cmRes.data ?? []).length,
    scannedOrder: (osRes.data ?? []).length,
    createdContact: contactResults.filter(Boolean).length,
    createdOrder: orderResults.filter(Boolean).length,
  }
}
