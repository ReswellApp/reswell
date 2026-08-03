import { createServiceRoleClient } from "@/lib/supabase/server"
import { listConversationIdsLinkedToSupportTickets } from "@/lib/db/contactMessages"
import { loadMessagesInboxForUser, type MessagesInboxPayload } from "@/lib/db/messagesInbox"
import { resolveSupportRecipientUserId } from "@/lib/services/resolveSupportRecipientUser"
import {
  isSupportInboxConversation,
  type InboxConversationRow,
} from "@/lib/utils/messages-inbox-grouping"

/**
 * Keep marketplace threads; drop only real support-ticket DMs (linked in
 * contact_messages). Orphaned member↔support general threads — including staff
 * messages that never got a ticket — stay visible in `/messages`.
 */
export async function retainMarketplaceInboxConversations(
  conversations: InboxConversationRow[],
  supportUserId: string | null | undefined,
): Promise<InboxConversationRow[]> {
  if (!supportUserId) return conversations

  const supportLikeIds = conversations
    .filter((c) => isSupportInboxConversation(c, supportUserId))
    .map((c) => c.id)

  if (supportLikeIds.length === 0) return conversations

  const supabase = createServiceRoleClient()
  const ticketedIds = await listConversationIdsLinkedToSupportTickets(supabase, supportLikeIds)

  return conversations.filter((c) => {
    if (!isSupportInboxConversation(c, supportUserId)) return true
    return !ticketedIds.has(c.id)
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
