import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import {
  bulkUpdateContactMessageRows,
  getContactMessageRowById,
  updateContactMessageRow,
  type ContactMessageSupportStatus,
} from "@/lib/db/contactMessages"
import { ensureConversationBetweenBuyerAndSeller } from "@/lib/db/conversations"
import {
  bulkUpdateContactMessagesAdminSchema,
  updateContactMessageAdminSchema,
  type UpdateContactMessageAdminInput,
} from "@/lib/validations/contactMessagesAdmin"
import { trackKlaviyoSupportTicketResponse } from "@/lib/klaviyo/track-support-ticket-response"
import { resolveSupportRecipientUserId } from "@/lib/services/resolveSupportRecipientUser"
import {
  insertSupportStaffThreadMessage,
  insertSupportStatusMessageAsSupportUser,
} from "@/lib/services/supportTicketThreadNotifications"
import {
  ensureSupportTicketThreadSchema,
  supportTicketReplyFromAdminSchema,
} from "@/lib/validations/contactMessageAdminReply"

function normalizeUpdatePayload(
  parsed: UpdateContactMessageAdminInput,
): {
  id: string
  support_status?: ContactMessageSupportStatus
  internal_notes?: string | null
} {
  const out: {
    id: string
    support_status?: ContactMessageSupportStatus
    internal_notes?: string | null
  } = { id: parsed.id }

  if (parsed.support_status !== undefined) {
    out.support_status = parsed.support_status
  }
  if (parsed.internal_notes !== undefined) {
    const n = parsed.internal_notes.trim()
    out.internal_notes = n === "" ? null : parsed.internal_notes
  }
  return out
}

export async function updateContactMessageAdminService(
  raw: unknown,
): Promise<{ success: true } | { error: string }> {
  const parsed = updateContactMessageAdminSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid input" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { error: "Forbidden" }
  }

  const existing = await getContactMessageRowById(supabase, parsed.data.id)
  if (!existing) {
    return { error: "Not found" }
  }

  const payload = normalizeUpdatePayload(parsed.data)
  const { error } = await updateContactMessageRow(supabase, payload)
  if (error) {
    console.error("updateContactMessageAdminService", error)
    return { error: "Failed to save" }
  }

  const statusChanged =
    payload.support_status !== undefined && payload.support_status !== existing.support_status

  if (
    statusChanged &&
    existing.support_conversation_id
  ) {
    const resolved = await resolveSupportRecipientUserId()
    if (resolved.ok) {
      const posted = await insertSupportStatusMessageAsSupportUser({
        conversationId: existing.support_conversation_id,
        supportUserId: resolved.userId,
        status: payload.support_status!,
        ticketId: existing.id,
      })
      if (!posted.ok) {
        console.error("updateContactMessageAdminService: failed to post ticket status message")
      } else if (
        posted.messageId &&
        posted.customerVisibleContent &&
        existing.email.trim()
      ) {
        await trackKlaviyoSupportTicketResponse({
          supportTicketId: existing.id,
          email: existing.email.trim(),
          externalId: existing.user_id,
          response: posted.customerVisibleContent,
          responseType: "status_update",
          supportStatus: payload.support_status!,
          uniqueId: `support-ticket-response-${posted.messageId}`,
        })
      }
    }
  }

  return { success: true }
}

/**
 * Bulk status change for the support inbox. Performs a single update query and
 * intentionally skips the per-ticket member notifications that the single-row
 * `updateContactMessageAdminService` sends — bulk triage is an internal workflow
 * action, so members are not pinged for each ticket.
 */
export async function bulkUpdateContactMessagesAdminService(
  raw: unknown,
): Promise<{ success: true } | { error: string }> {
  const parsed = bulkUpdateContactMessagesAdminSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid input" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { error: "Forbidden" }
  }

  const { error } = await bulkUpdateContactMessageRows(supabase, parsed.data.ids, {
    support_status: parsed.data.support_status,
  })
  if (error) {
    console.error("bulkUpdateContactMessagesAdminService", error)
    return { error: "Failed to update tickets" }
  }

  return { success: true }
}

function adminSupportRoutingError(resolved: { ok: false; error: string }): string {
  const hasId = Boolean(process.env.MESSAGES_DIRECT_SUPPORT_USER_ID?.trim())
  const hasEmail = Boolean(process.env.MESSAGES_DIRECT_SUPPORT_EMAIL?.trim())
  if (!hasId && !hasEmail) {
    return "Support routing isn’t configured. Set MESSAGES_DIRECT_SUPPORT_USER_ID (preferred) or MESSAGES_DIRECT_SUPPORT_EMAIL in your environment (see .env.example), then restart the dev server."
  }
  return `Support routing failed: ${resolved.error}`
}

function formatLinkedSupportThreadIntro(args: { ticketId: string; topic: string | null }): string {
  const topicLabel = args.topic?.trim() || "Support request"
  return [
    "Reswell support ticket",
    "",
    `Topic: ${topicLabel}`,
    "",
    "This chat is linked to your support request — our team can reply here anytime.",
    "",
    `Ticket ID: ${args.ticketId}`,
  ].join("\n")
}

async function loadTicketForSupportInboxStaff(
  supabaseUser: Awaited<ReturnType<typeof createClient>>,
  ticketId: string,
): Promise<
  | { ok: false; error: string }
  | {
      ok: true
      supabaseUser: Awaited<ReturnType<typeof createClient>>
      row: NonNullable<Awaited<ReturnType<typeof getContactMessageRowById>>>
    }
> {
  const {
    data: { user },
  } = await supabaseUser.auth.getUser()
  if (!user) {
    return { ok: false, error: "Unauthorized" }
  }

  const { data: profile } = await supabaseUser
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { ok: false, error: "Forbidden" }
  }

  const row = await getContactMessageRowById(supabaseUser, ticketId)
  if (!row) {
    return { ok: false, error: "Not found" }
  }

  return { ok: true, supabaseUser, row }
}

/**
 * Ensures member ↔ support teammate conversation exists for this ticket and saves `support_conversation_id`.
 */
export async function ensureSupportTicketThreadAdminService(
  raw: unknown,
): Promise<{ success: true; support_conversation_id: string } | { error: string }> {
  const parsed = ensureSupportTicketThreadSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid input" }
  }

  const supabaseUser = await createClient()
  const loaded = await loadTicketForSupportInboxStaff(supabaseUser, parsed.data.ticket_id)
  if (!loaded.ok) {
    return { error: loaded.error }
  }

  const { row, supabaseUser: sb } = loaded

  if (!row.user_id) {
    return { error: "This ticket has no member account linked — inbox replies are unavailable." }
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

  const memberId = row.user_id
  const supportUserId = resolvedSupport.userId
  if (memberId === supportUserId) {
    return { error: "Routing conflict for this ticket." }
  }

  if (row.support_conversation_id) {
    return { success: true, support_conversation_id: row.support_conversation_id }
  }

  const conv = await ensureConversationBetweenBuyerAndSeller(serviceRole, memberId, supportUserId)
  if (!conv?.id) {
    return { error: "Could not create the support conversation." }
  }

  const conversationId = conv.id

  const { error } = await updateContactMessageRow(sb, {
    id: row.id,
    support_conversation_id: conversationId,
  })

  if (error) {
    console.error("ensureSupportTicketThreadAdminService patch", error)
    return { error: "Could not save the linked thread." }
  }

  const posted = await insertSupportStaffThreadMessage({
    conversationId,
    supportUserId,
    content: formatLinkedSupportThreadIntro({ ticketId: row.id, topic: row.subject }),
  })

  if (!posted.ok) {
    console.error("ensureSupportTicketThreadAdminService: intro message insert failed")
  }

  return { success: true, support_conversation_id: conversationId }
}

export async function sendSupportTicketAdminReplyService(
  raw: unknown,
): Promise<{ success: true; support_conversation_id: string } | { error: string }> {
  const parsed = supportTicketReplyFromAdminSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid input" }
  }

  const supabaseUser = await createClient()
  const loaded = await loadTicketForSupportInboxStaff(supabaseUser, parsed.data.ticket_id)
  if (!loaded.ok) {
    return { error: loaded.error }
  }

  const { row, supabaseUser: sb } = loaded

  if (!row.user_id) {
    return { error: "This ticket has no member account linked — inbox replies are unavailable." }
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

  const memberId = row.user_id
  const supportUserId = resolvedSupport.userId
  if (memberId === supportUserId) {
    return { error: "Routing conflict for this ticket." }
  }

  let conversationId = row.support_conversation_id
  if (!conversationId) {
    const conv = await ensureConversationBetweenBuyerAndSeller(serviceRole, memberId, supportUserId)
    if (!conv?.id) {
      return { error: "Could not create the support conversation." }
    }
    conversationId = conv.id

    const { error: patchErr } = await updateContactMessageRow(sb, {
      id: row.id,
      support_conversation_id: conversationId,
    })

    if (patchErr) {
      console.error("sendSupportTicketAdminReplyService patch", patchErr)
      return { error: "Could not link the reply to this ticket." }
    }
  }

  const trimmed = parsed.data.content.trim()
  const posted = await insertSupportStaffThreadMessage({
    conversationId,
    supportUserId,
    content: trimmed,
  })

  if (!posted.ok) {
    return { error: "Could not send the message." }
  }

  if (row.email.trim()) {
    void trackKlaviyoSupportTicketResponse({
      supportTicketId: row.id,
      email: row.email.trim(),
      externalId: row.user_id,
      response: trimmed,
      responseType: "admin_inbox_reply",
      uniqueId: `support-ticket-admin-inbox-${posted.messageId}`,
    })
  }

  return { success: true, support_conversation_id: conversationId }
}
