import {
  deleteMarketplaceMessageAsAdmin,
  listAdminMarketplaceConversations,
  listAdminMarketplaceMessages,
  type ListAdminMarketplaceConversationsArgs,
  type ListAdminMarketplaceMessagesArgs,
} from "@/lib/db/adminMarketplaceMessages"
import { broadcastMarketplaceThreadRefresh } from "@/lib/services/broadcastMarketplaceThreadMessage"
import { createServiceRoleClient } from "@/lib/supabase/server"

export async function getAdminMarketplaceMessages(args: ListAdminMarketplaceMessagesArgs) {
  const supabase = createServiceRoleClient()
  return listAdminMarketplaceMessages(supabase, args)
}

export async function getAdminMarketplaceConversations(args: ListAdminMarketplaceConversationsArgs) {
  const supabase = createServiceRoleClient()
  return listAdminMarketplaceConversations(supabase, args)
}

export async function removeAdminMarketplaceMessage(messageId: string) {
  const supabase = createServiceRoleClient()
  const result = await deleteMarketplaceMessageAsAdmin(supabase, messageId)
  if (result.ok) {
    await broadcastMarketplaceThreadRefresh(result.conversationId)
  }
  return result
}
