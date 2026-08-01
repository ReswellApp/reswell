import { createServiceRoleClient } from "@/lib/supabase/server"
import { findMessagesSupportTicketMetaByConversationId } from "@/lib/db/contactMessages"
import { resolveSupportRecipientUserId } from "@/lib/services/resolveSupportRecipientUser"
import { isSupportInboxConversation } from "@/lib/utils/messages-inbox-grouping"

/**
 * If this conversation is a Reswell Support ticket thread, returns the member
 * Support URL to redirect marketplace `/messages` deep links.
 */
export async function resolveSupportRedirectForConversation(
  conversationId: string,
): Promise<string | null> {
  const supportResolved = await resolveSupportRecipientUserId()
  if (!supportResolved.ok) return null

  const supabase = createServiceRoleClient()
  const { data: conv, error } = await supabase
    .from("conversations")
    .select("id, listing_id, buyer_id, seller_id")
    .eq("id", conversationId)
    .maybeSingle()

  if (error || !conv) return null

  if (
    !isSupportInboxConversation(
      {
        listing_id: (conv.listing_id as string | null) ?? null,
        buyer_id: conv.buyer_id as string,
        seller_id: conv.seller_id as string,
      },
      supportResolved.userId,
    )
  ) {
    return null
  }

  const ticket = await findMessagesSupportTicketMetaByConversationId(supabase, conversationId)
  if (ticket?.id) {
    return `/dashboard/support/${ticket.id}`
  }
  return "/dashboard/support"
}
