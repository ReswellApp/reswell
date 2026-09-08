import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getSupportCaseByContactMessageId,
  getSupportCaseByOrderSupportId,
  insertSupportCase,
  insertSupportCaseMessage,
  listSupportCasesForRequester,
  type SupportCaseRow,
} from "@/lib/db/supportCases"
import { listContactMessagesForUser } from "@/lib/db/contactMessages"
import { listOrderSupportRequestsForUser } from "@/lib/db/order-support"
import { orderRequestTypeSubject, orderRequestTypeToKind } from "@/lib/utils/support-case-display"
import { supportTicketDisplaySubject } from "@/lib/utils/support-ticket-display"
import type { SupportCaseKind } from "@/lib/types/supportCase"

/**
 * Create a support_cases row for a legacy ticket if one does not exist yet.
 * Safe to call on every list/resolve — skipped when the FK already matches.
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
      .filter((row) => !haveContact.has(row.id))
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
