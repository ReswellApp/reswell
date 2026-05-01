import { getAdminConversationHeaderById } from "@/lib/db/adminConversations"
import { createServiceRoleClient } from "@/lib/supabase/server"

export async function getAdminConversationHeader(conversationId: string) {
  const supabase = createServiceRoleClient()
  return getAdminConversationHeaderById(supabase, conversationId)
}
