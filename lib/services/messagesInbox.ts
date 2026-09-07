import { createServiceRoleClient } from "@/lib/supabase/server"
import { listConversationIdsLinkedToSupportTickets } from "@/lib/db/contactMessages"
import { listConversationIdsLinkedToOrderSupport } from "@/lib/db/order-support"
import { loadMessagesInboxForUser, type MessagesInboxPayload } from "@/lib/db/messagesInbox"
import { resolveSupportRecipientUserId } from "@/lib/services/resolveSupportRecipientUser"
import {
  isSupportInboxConversation,
  type InboxConversationRow,
} from "@/lib/utils/messages-inbox-grouping"

/**
 * Marketplace `/messages` never shows Reswell Support threads.
 * Hide member↔support DMs (listing_id null, support user as seller) and any
 * conversation linked as a support_conversation_id — including order claims.
 * Staff-outbound marketplace DMs (staff as buyer) stay here.
 */
export async function retainMarketplaceInboxConversations(
  conversations: InboxConversationRow[],
  supportUserId: string | null | undefined,
): Promise<InboxConversationRow[]> {
  if (conversations.length === 0) return conversations

  const allIds = conversations.map((c) => c.id)
  const supabase = createServiceRoleClient()
  const [ticketedIds, orderTicketedIds] = await Promise.all([
    listConversationIdsLinkedToSupportTickets(supabase, allIds),
    listConversationIdsLinkedToOrderSupport(supabase, allIds),
  ])

  return conversations.filter((c) => {
    if (ticketedIds.has(c.id) || orderTicketedIds.has(c.id)) return false
    if (isSupportInboxConversation(c, supportUserId)) return false
    return true
  })
}

/**
 * Marketplace Messages inbox for a member. Excludes Reswell Support ticket DMs
 * so those only appear under `/dashboard/support`.
 */
export async function getMessagesInboxForUser(userId: string): Promise<MessagesInboxPayload> {
  const payload = await loadMessagesInboxForUser(userId)
  const supportResolved = await resolveSupportRecipientUserId()
  const supportUserId = supportResolved.ok ? supportResolved.userId : null

  return {
    ...payload,
    conversations: await retainMarketplaceInboxConversations(payload.conversations, supportUserId),
  }
}
