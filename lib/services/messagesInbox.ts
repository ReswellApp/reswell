import { loadMessagesInboxForUser, type MessagesInboxPayload } from "@/lib/db/messagesInbox"
import { resolveSupportRecipientUserId } from "@/lib/services/resolveSupportRecipientUser"
import { filterOutSupportInboxConversations } from "@/lib/utils/messages-inbox-grouping"

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
    conversations: filterOutSupportInboxConversations(payload.conversations, supportUserId),
  }
}
