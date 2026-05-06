import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { ContactMessageSupportStatus } from "@/lib/db/contactMessages"

/** Customer-visible line when workflow status changes in admin. */
const STATUS_TO_MEMBER_LINE: Record<ContactMessageSupportStatus, string> = {
  new: "Status: New — we’re reviewing your request.",
  triaged: "Status: Triaged — a teammate is on it.",
  ticket_created: "Status: In progress — we’re working on this with you here.",
  resolved: "Status: Resolved. Reply here anytime if you still need help.",
}

export function formatSupportTicketOpeningMessage(args: {
  ticketId: string
  topicLabel: string
  body: string
}): string {
  return [
    "Reswell support ticket",
    "",
    `Topic: ${args.topicLabel}`,
    "",
    "—",
    "",
    args.body.trim(),
    "",
    "—",
    "",
    `Ticket ID: ${args.ticketId}`,
    "You’ll get updates in this chat as our team moves it forward.",
  ].join("\n")
}

export async function insertMemberMessageInConversation(
  supabase: SupabaseClient,
  args: { conversationId: string; senderId: string; content: string },
): Promise<boolean> {
  const { error } = await supabase.from("messages").insert({
    conversation_id: args.conversationId,
    sender_id: args.senderId,
    content: args.content,
  })
  if (error) {
    console.error("insertMemberMessageInConversation", error)
    return false
  }
  return true
}

/** Inserts an in-thread update as the support teammate (service role; appears in /messages). */
export async function insertSupportStatusMessageAsSupportUser(args: {
  conversationId: string
  supportUserId: string
  status: ContactMessageSupportStatus
  ticketId: string
}): Promise<{
  ok: boolean
  messageId?: string
  customerVisibleContent?: string
}> {
  const line = STATUS_TO_MEMBER_LINE[args.status]
  const content = ["Reswell — ticket update", "", line, "", `Ticket ID: ${args.ticketId}`].join("\n")

  const svc = createServiceRoleClient()
  const { data, error } = await svc
    .from("messages")
    .insert({
      conversation_id: args.conversationId,
      sender_id: args.supportUserId,
      content,
    })
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("insertSupportStatusMessageAsSupportUser", error)
    return { ok: false }
  }
  const id = data?.id != null ? String(data.id) : undefined
  if (!id) {
    return { ok: false }
  }
  return {
    ok: true,
    messageId: id,
    customerVisibleContent: content,
  }
}
