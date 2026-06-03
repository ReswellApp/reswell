import { createServiceRoleClient } from "@/lib/supabase/server"

export type AdminSendMarketplaceThreadMessageResult =
  | {
      ok: true
      message: {
        id: string
        conversation_id: string
        sender_id: string
        content: string
        created_at: string
      }
    }
  | { ok: false; error: string; status: number }

/**
 * Inserts a text message into a buyer↔seller thread as the given staff user.
 * Uses the service role so the sender need not be a conversation participant.
 */
export async function adminSendMarketplaceThreadMessage(input: {
  conversationId: string
  staffUserId: string
  content: string
}): Promise<AdminSendMarketplaceThreadMessageResult> {
  const { conversationId, staffUserId } = input
  const content = input.content.trim().slice(0, 8000)

  if (!content) {
    return { ok: false, error: "Message cannot be empty", status: 400 }
  }

  const supabase = createServiceRoleClient()

  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .maybeSingle()

  if (convErr || !conv) {
    return { ok: false, error: "Conversation not found", status: 404 }
  }

  const { data: inserted, error: insErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: staffUserId,
      content,
    })
    .select("id, conversation_id, sender_id, content, created_at")
    .single()

  if (insErr || !inserted) {
    console.error("[adminSendMarketplaceThreadMessage] insert:", insErr)
    return { ok: false, error: "Could not send message", status: 500 }
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId)

  return {
    ok: true,
    message: {
      id: inserted.id as string,
      conversation_id: inserted.conversation_id as string,
      sender_id: inserted.sender_id as string,
      content: inserted.content as string,
      created_at: inserted.created_at as string,
    },
  }
}
