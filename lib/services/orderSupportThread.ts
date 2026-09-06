import { z } from "zod"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { userParticipatesInConversation, ensureConversationBetweenBuyerAndSeller } from "@/lib/db/conversations"
import {
  getOrderSupportRequestById,
  updateOrderSupportRequestAdmin,
  type OrderSupportRequestRow,
} from "@/lib/db/order-support"
import { resolveSupportRecipientUserId } from "@/lib/services/resolveSupportRecipientUser"
import {
  formatSupportCaseWelcomeMessage,
  insertMemberMessageInConversation,
  insertSupportStaffThreadMessage,
} from "@/lib/services/supportTicketThreadNotifications"
import { trackKlaviyoSupportTicketResponse } from "@/lib/klaviyo/track-support-ticket-response"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { formatSupportCaseReference, orderRequestTypeSubject } from "@/lib/utils/support-case-display"
import { supportCaseResponseAbsoluteUrl } from "@/lib/utils/support-case-paths"

const replySchema = z.object({
  case_id: z.string().uuid(),
  content: z.string().trim().min(1).max(12000),
})

function adminSupportRoutingError(resolved: { ok: false; error: string }): string {
  const hasId = Boolean(process.env.MESSAGES_DIRECT_SUPPORT_USER_ID?.trim())
  const hasEmail = Boolean(process.env.MESSAGES_DIRECT_SUPPORT_EMAIL?.trim())
  if (!hasId && !hasEmail) {
    return "Support routing isn’t configured. Set MESSAGES_DIRECT_SUPPORT_USER_ID or MESSAGES_DIRECT_SUPPORT_EMAIL."
  }
  return `Support routing failed: ${resolved.error}`
}

async function requireStaff(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { ok: false, error: "Forbidden" }
  }

  return { ok: true, supabase }
}

async function memberEmailForUserId(userId: string): Promise<string> {
  try {
    const service = createServiceRoleClient()
    const { data } = await service.auth.admin.getUserById(userId)
    return (data.user?.email ?? "").trim()
  } catch (err) {
    console.warn("[orderSupportThread] could not load member email", err)
    return ""
  }
}

function orderCaseTicketUrl(caseId: string): string {
  return supportCaseResponseAbsoluteUrl(publicSiteOriginForEmail(), caseId)
}

/**
 * Ensures member ↔ Reswell support conversation for an order case.
 * Posts an opening message if the thread is newly created.
 */
export async function ensureOrderSupportThreadService(
  caseId: string,
  options?: { openingBody?: string },
): Promise<{ success: true; support_conversation_id: string } | { error: string }> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  const row = await getOrderSupportRequestById(staff.supabase, caseId)
  if (!row) return { error: "Case not found" }

  return linkOrderSupportThread(row, options?.openingBody)
}

/** Used by APIs on create (service role) and admin ensure. */
export async function linkOrderSupportThread(
  row: OrderSupportRequestRow,
  openingBody?: string,
): Promise<{ success: true; support_conversation_id: string } | { error: string }> {
  if (row.support_conversation_id) {
    return { success: true, support_conversation_id: row.support_conversation_id }
  }

  let serviceRole
  try {
    serviceRole = createServiceRoleClient()
  } catch {
    return { error: "Messaging is not available in this environment." }
  }

  const resolvedSupport = await resolveSupportRecipientUserId()
  if (!resolvedSupport.ok) {
    return { error: adminSupportRoutingError(resolvedSupport) }
  }

  const memberId = row.buyer_id
  const supportUserId = resolvedSupport.userId
  if (memberId === supportUserId) {
    return { error: "Routing conflict for this case." }
  }

  const conv = await ensureConversationBetweenBuyerAndSeller(serviceRole, memberId, supportUserId)
  if (!conv?.id) {
    return { error: "Could not create the support conversation." }
  }

  const conversationId = conv.id
  const { error } = await updateOrderSupportRequestAdmin(serviceRole, {
    id: row.id,
    support_conversation_id: conversationId,
  })

  if (error) {
    // Column may not exist yet — soft fail
    console.error("linkOrderSupportThread patch", error)
    return { error: "Could not save the linked thread. Apply the latest migration and retry." }
  }

  const topic = orderRequestTypeSubject(row.request_type, row.order_ref)
  const customerBody = (openingBody?.trim() || row.body).trim()
  const caseRef = formatSupportCaseReference(row.id)

  if (customerBody) {
    const memberPosted = await insertMemberMessageInConversation(serviceRole, {
      conversationId,
      senderId: memberId,
      content: customerBody,
    })
    if (!memberPosted) {
      console.error("linkOrderSupportThread: customer opening message insert failed")
    }
  }

  const welcomePosted = await insertSupportStaffThreadMessage({
    conversationId,
    supportUserId,
    content: formatSupportCaseWelcomeMessage({ topicLabel: topic, caseRef }),
  })

  if (!welcomePosted.ok) {
    console.error("linkOrderSupportThread: welcome message insert failed")
  }

  return { success: true, support_conversation_id: conversationId }
}

export async function sendOrderSupportAdminReplyService(
  raw: unknown,
): Promise<{ success: true; support_conversation_id: string } | { error: string }> {
  const parsed = replySchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid input" }

  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  const row = await getOrderSupportRequestById(staff.supabase, parsed.data.case_id)
  if (!row) return { error: "Case not found" }

  let conversationId = row.support_conversation_id
  if (!conversationId) {
    const linked = await linkOrderSupportThread(row)
    if ("error" in linked) return linked
    conversationId = linked.support_conversation_id
  }

  const resolvedSupport = await resolveSupportRecipientUserId()
  if (!resolvedSupport.ok) {
    return { error: adminSupportRoutingError(resolvedSupport) }
  }

  const trimmed = parsed.data.content.trim()
  const posted = await insertSupportStaffThreadMessage({
    conversationId,
    supportUserId: resolvedSupport.userId,
    content: trimmed,
  })

  if (!posted.ok) {
    return { error: "Could not send the message." }
  }

  // Mark in progress when staff replies
  if (row.support_status === "new" || row.support_status === "triaged") {
    await updateOrderSupportRequestAdmin(staff.supabase, {
      id: row.id,
      support_status: "investigating",
    })
  }

  const email = await memberEmailForUserId(row.buyer_id)
  if (email) {
    void trackKlaviyoSupportTicketResponse({
      supportTicketId: row.id,
      email,
      externalId: row.buyer_id,
      response: trimmed,
      responseType: "admin_inbox_reply",
      ticketUrl: orderCaseTicketUrl(row.id),
      uniqueId: `order-support-admin-reply-${posted.messageId}`,
    })
  }

  return { success: true, support_conversation_id: conversationId }
}

/** Member reply on an order case thread (Help portal). */
export async function sendOrderSupportMemberReplyService(
  raw: unknown,
): Promise<{ success: true } | { error: string }> {
  const parsed = replySchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in to reply." }

  const row = await getOrderSupportRequestById(supabase, parsed.data.case_id)
  if (!row || row.buyer_id !== user.id) {
    return { error: "Case not found." }
  }

  if (!row.support_conversation_id) {
    return {
      error:
        "Your support chat is not ready yet. Our team will reach out soon — you can reply here once the thread is linked.",
    }
  }

  const participates = await userParticipatesInConversation(
    supabase,
    user.id,
    row.support_conversation_id,
  )
  if (!participates) {
    return { error: "You do not have access to this conversation." }
  }

  const posted = await insertMemberMessageInConversation(supabase, {
    conversationId: row.support_conversation_id,
    senderId: user.id,
    content: parsed.data.content.trim(),
  })

  if (!posted) {
    return { error: "Could not send your message. Try again in a moment." }
  }

  if (row.support_status === "waiting_on_customer") {
    await updateOrderSupportRequestAdmin(createServiceRoleClient(), {
      id: row.id,
      support_status: "investigating",
    })
  }

  return { success: true }
}
