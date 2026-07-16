import type { SupabaseClient } from "@supabase/supabase-js"

export interface TrailingMessageRow {
  sender_id: string
  content: string
}

/**
 * Most recent messages in a conversation, newest first.
 * Used by messaging policy enforcement to detect payloads split across messages.
 */
export async function getTrailingMessagesForConversation(
  supabase: SupabaseClient,
  conversationId: string,
  limit: number,
): Promise<TrailingMessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("sender_id, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data) {
    if (error) {
      console.error("[conversationTrailingMessages] select:", error.message)
    }
    return []
  }

  return data as TrailingMessageRow[]
}
