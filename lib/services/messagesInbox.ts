import { createServiceRoleClient } from "@/lib/supabase/server"
import { listConversationIdsLinkedToSupportTickets } from "@/lib/db/contactMessages"
import { listConversationIdsLinkedToOrderSupport } from "@/lib/db/order-support"
import { loadMessagesInboxForUser, type MessagesInboxPayload } from "@/lib/db/messagesInbox"
import {
  redactShippingLabelArtifactsFromMessage,
  shippingLabelOrderIdFromMessage,
} from "@/lib/messages/redact-seller-shipping-label"
import { fetchSantaBarbaraDropoffOrderIds } from "@/lib/services/santaBarbaraDropoffOrderAccess"
import { resolveSupportRecipientUserId } from "@/lib/services/resolveSupportRecipientUser"
import { loadSupportInboxActivityNotifications } from "@/lib/services/supportInboxActivity"
import { mergeInboxActivityNotifications } from "@/lib/utils/support-inbox-activity"
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

  let supportActivity: MessagesInboxPayload["notifications"] = []
  let hiddenShippingLabelOrderIds = new Set<string>()
  try {
    const supabase = createServiceRoleClient()
    try {
      supportActivity = await loadSupportInboxActivityNotifications(supabase, userId)
    } catch (err) {
      console.warn("[messagesInbox] support activity skipped", err)
    }
    const sellerLabelOrderIds = payload.conversations
      .filter((conversation) => conversation.seller_id === userId)
      .flatMap((conversation) => conversation.messages)
      .map((message) => shippingLabelOrderIdFromMessage(message))
      .filter((orderId): orderId is string => Boolean(orderId))
    if (sellerLabelOrderIds.length > 0) {
      hiddenShippingLabelOrderIds = await fetchSantaBarbaraDropoffOrderIds(
        supabase,
        sellerLabelOrderIds,
      )
    }
  } catch (err) {
    console.warn("[messagesInbox] santa barbara label redaction skipped", err)
  }

  const conversations = await retainMarketplaceInboxConversations(
    payload.conversations,
    supportUserId,
  )
  const redactedConversations =
    hiddenShippingLabelOrderIds.size === 0
      ? conversations
      : conversations.map((conversation) => {
          if (conversation.seller_id !== userId) return conversation
          return {
            ...conversation,
            messages: conversation.messages.map((message) => {
              const orderId = shippingLabelOrderIdFromMessage(message)
              if (!orderId || !hiddenShippingLabelOrderIds.has(orderId)) return message
              return redactShippingLabelArtifactsFromMessage(message)
            }),
          }
        })

  return {
    conversations: redactedConversations,
    notifications: mergeInboxActivityNotifications(payload.notifications, supportActivity),
  }
}
