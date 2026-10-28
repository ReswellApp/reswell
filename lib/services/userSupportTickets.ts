import { createClient } from "@/lib/supabase/server"
import {
  getContactMessageForUser,
  listContactMessagesForUser,
  type ContactMessageUserRow,
  type UserSupportTicketFilter,
} from "@/lib/db/contactMessages"
import { ensureCaseForContactMessage } from "@/lib/services/supportCaseBackfill"
import { sendSupportCaseMemberReplyForSession } from "@/lib/services/supportCaseThread"
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

  const opened = await ensureCaseForContactMessage(supabase, {
    id: ticket.id,
    subject: ticket.subject,
    message: ticket.message,
    email: ticket.email,
    user_id: ticket.user_id,
    source: ticket.source,
  })
  if (!opened) {
    return { error: "Could not open your support case. Try again in a moment." }
  }

  const posted = await sendSupportCaseMemberReplyForSession(
    supabase,
    user.id,
    opened.id,
    parsed.data.content.trim(),
  )
  if ("error" in posted) return posted
  return { success: true }
}
