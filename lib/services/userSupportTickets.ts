import { createClient } from "@/lib/supabase/server"
import {
  getContactMessageForUser,
  listContactMessagesForUser,
  type ContactMessageUserRow,
  type UserSupportTicketFilter,
} from "@/lib/db/contactMessages"
import { userParticipatesInConversation } from "@/lib/db/conversations"
import { insertMemberMessageInConversation } from "@/lib/services/supportTicketThreadNotifications"
import { userSupportTicketReplySchema } from "@/lib/validations/userSupportTickets"

export async function listUserSupportTicketsService(
  userId: string,
  filter: UserSupportTicketFilter = "all",
): Promise<ContactMessageUserRow[]> {
  const supabase = await createClient()
  return listContactMessagesForUser(supabase, userId, filter)
}

export async function getUserSupportTicketService(
  userId: string,
  ticketId: string,
): Promise<ContactMessageUserRow | null> {
  const supabase = await createClient()
  return getContactMessageForUser(supabase, userId, ticketId)
}

export async function sendUserSupportTicketReplyService(
  raw: unknown,
): Promise<{ success: true } | { error: string }> {
  const parsed = userSupportTicketReplySchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors
    return { error: first.content?.[0] ?? first.ticket_id?.[0] ?? "Invalid input" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Sign in to reply." }
  }

  const ticket = await getContactMessageForUser(supabase, user.id, parsed.data.ticket_id)
  if (!ticket) {
    return { error: "Ticket not found." }
  }

  if (!ticket.support_conversation_id) {
    return {
      error:
        "Your support chat is not ready yet. Our team will reach out by email — you can reply here once the thread is linked.",
    }
  }

  const participates = await userParticipatesInConversation(
    supabase,
    user.id,
    ticket.support_conversation_id,
  )
  if (!participates) {
    return { error: "You do not have access to this conversation." }
  }

  const posted = await insertMemberMessageInConversation(supabase, {
    conversationId: ticket.support_conversation_id,
    senderId: user.id,
    content: parsed.data.content.trim(),
  })

  if (!posted) {
    return { error: "Could not send your message. Try again in a moment." }
  }

  return { success: true }
}
