import { z } from "zod"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import {
  getSupportCaseById,
  insertSupportCaseMessage,
  listSupportCaseMessages,
  resolveSupportCaseByAnyId,
  touchSupportCaseAfterMessage,
  type SupportCaseMessageRow,
  type SupportCaseRow,
} from "@/lib/db/supportCases"
import { getContactMessageForUser, getContactMessageRowById } from "@/lib/db/contactMessages"
import { getOrderSupportRequestById, getOrderSupportRequestForUser } from "@/lib/db/order-support"
import {
  ensureCaseForContactMessage,
  ensureCaseForOrderSupport,
} from "@/lib/services/supportCaseBackfill"
import { supportCaseReplySchema } from "@/lib/validations/supportCaseThread"
import { trackKlaviyoSupportTicketResponse } from "@/lib/klaviyo/track-support-ticket-response"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { supportCaseResponseAbsoluteUrl } from "@/lib/utils/support-case-paths"

export type SupportCaseThreadMessage = SupportCaseMessageRow

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

async function resolveOrBackfillForMember(
  userId: string,
  caseId: string,
): Promise<SupportCaseRow | null> {
  const supabase = await createClient()
  const direct = await resolveSupportCaseByAnyId(supabase, caseId)
  if (direct && direct.requester_user_id === userId) return direct

  const orderRow = await getOrderSupportRequestForUser(supabase, userId, caseId)
  if (orderRow) {
    return ensureCaseForOrderSupport(supabase, {
      id: orderRow.id,
      request_type: orderRow.request_type,
      body: orderRow.body,
      buyer_id: orderRow.buyer_id,
      order_id: orderRow.order_id,
      order_ref: orderRow.order_ref,
      requester_role: orderRow.requester_role,
    })
  }

  const ticket = await getContactMessageForUser(supabase, userId, caseId)
  if (ticket) {
    return ensureCaseForContactMessage(supabase, {
      id: ticket.id,
      subject: ticket.subject,
      message: ticket.message,
      email: ticket.email,
      user_id: ticket.user_id,
      source: ticket.source,
    })
  }

  return direct && direct.requester_user_id === userId ? direct : null
}

export async function getSupportCaseThreadForMember(
  userId: string,
  caseId: string,
): Promise<{ case: SupportCaseRow; messages: SupportCaseThreadMessage[] } | { error: string }> {
  const supabase = await createClient()
  const row = await resolveOrBackfillForMember(userId, caseId)
  if (!row || row.requester_user_id !== userId) {
    return { error: "Case not found." }
  }
  const messages = await listSupportCaseMessages(supabase, row.id)
  return { case: row, messages }
}

export async function getSupportCaseThreadForStaff(
  caseId: string,
): Promise<{ case: SupportCaseRow; messages: SupportCaseThreadMessage[] } | { error: string }> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    service = staff.supabase
  }

  let row = await resolveSupportCaseByAnyId(service, caseId)
  if (!row) {
    const order = await getOrderSupportRequestById(service, caseId)
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
    const ticket = await getContactMessageRowById(service, caseId)
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
  if (!row) return { error: "Case not found." }
  const messages = await listSupportCaseMessages(service, row.id, { includeInternal: true })
  return { case: row, messages }
}

export async function sendSupportCaseMemberReplyService(
  raw: unknown,
): Promise<{ success: true; case_id: string } | { error: string }> {
  const parsed = supportCaseReplySchema.safeParse(raw)
  if (!parsed.success) return { error: "Write a message first." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in to reply." }

  const row = await resolveSupportCaseByAnyId(supabase, parsed.data.case_id)
  if (!row || row.requester_user_id !== user.id) {
    return { error: "Case not found." }
  }
  if (row.status === "resolved") {
    return { error: "This case is closed. Open a new request if you still need help." }
  }

  const body = parsed.data.content.trim()
  const posted = await insertSupportCaseMessage(supabase, {
    case_id: row.id,
    author_user_id: user.id,
    author_role: "customer",
    body,
  })
  if (posted.error) return { error: "Could not send your message." }

  await touchSupportCaseAfterMessage(supabase, {
    id: row.id,
    preview: body,
    status: row.status === "waiting_on_you" ? "in_progress" : undefined,
  })

  return { success: true, case_id: row.id }
}

export async function sendSupportCaseAdminReplyService(
  raw: unknown,
): Promise<{ success: true; case_id: string } | { error: string }> {
  const parsed = supportCaseReplySchema.safeParse(raw)
  if (!parsed.success) return { error: "Write a message first." }

  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    service = staff.supabase
  }

  const row = await resolveSupportCaseByAnyId(service, parsed.data.case_id)
  if (!row) return { error: "Case not found." }

  const body = parsed.data.content.trim()
  const isInternal = parsed.data.is_internal === true
  const posted = await insertSupportCaseMessage(service, {
    case_id: row.id,
    author_user_id: staff.userId,
    author_role: "agent",
    body,
    is_internal: isInternal,
  })
  if (posted.error) return { error: "Could not send the message." }

  if (isInternal) {
    await touchSupportCaseAfterMessage(service, {
      id: row.id,
      preview: `Note: ${body}`,
    })
    return { success: true, case_id: row.id }
  }

  const nextStatus =
    row.status === "submitted" || row.status === "in_review" || row.status === "waiting_on_you"
      ? "in_progress"
      : undefined

  await touchSupportCaseAfterMessage(service, {
    id: row.id,
    preview: body,
    status: nextStatus,
  })

  if (row.requester_email?.trim()) {
    void trackKlaviyoSupportTicketResponse({
      supportTicketId: row.id,
      email: row.requester_email.trim(),
      externalId: row.requester_user_id,
      response: body,
      responseType: "admin_inbox_reply",
      ticketUrl: supportCaseResponseAbsoluteUrl(publicSiteOriginForEmail(), row.id),
      uniqueId: `case-reply-${posted.id ?? row.id}`,
    })
  }

  return { success: true, case_id: row.id }
}

export async function postSupportCaseSystemMessage(
  caseId: string,
  body: string,
): Promise<void> {
  try {
    const service = createServiceRoleClient()
    const row = await getSupportCaseById(service, caseId)
    if (!row) return
    await insertSupportCaseMessage(service, {
      case_id: row.id,
      author_role: "system",
      body,
    })
    await touchSupportCaseAfterMessage(service, { id: row.id, preview: body })
  } catch (err) {
    console.warn("[supportCaseThread] system message skipped", err)
  }
}

export const supportCaseIdSchema = z.string().uuid()
