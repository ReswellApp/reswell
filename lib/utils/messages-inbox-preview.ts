import { capitalizeWords } from "@/lib/listing-labels"
import { parseOrderShippedThreadMessage } from "@/lib/messages/order-shipped-thread"
import { parseShippingLabelThreadMessage } from "@/lib/messages/shipping-label-thread"
import { parseSupportThreadSystemMessage } from "@/lib/messages/parse-support-thread-message"
import { formatMessageMediaPreviewText } from "@/lib/utils/message-media-preview-text"
import type { InboxConversationRow } from "@/lib/utils/messages-inbox-grouping"
import { parseMessageLocationMetadata } from "@/lib/validations/message-location-metadata"
import { parseOrderCompletedMessageMetadata } from "@/lib/validations/order-completed-message-metadata"
import { parseOrderExclusiveRepurchaseMessageMetadata } from "@/lib/validations/order-exclusive-repurchase-message-metadata"
import { parseOrderPlacedMessageMetadata } from "@/lib/validations/order-placed-message-metadata"
import { parseOrderRefundedMessageMetadata } from "@/lib/validations/order-refunded-message-metadata"
import { parseReviewRequestMessageMetadata } from "@/lib/validations/review-request-message-metadata"

function systemThreadInboxHint(
  lastMessage: InboxConversationRow["messages"][number],
): string | null {
  if (parseShippingLabelThreadMessage(lastMessage.content, lastMessage.metadata)) {
    return "Shipping label ready"
  }
  if (parseOrderShippedThreadMessage(lastMessage.content, lastMessage.metadata)) {
    return "Order shipped"
  }
  if (parseOrderPlacedMessageMetadata(lastMessage.metadata)) return "Order placed"
  if (parseOrderCompletedMessageMetadata(lastMessage.metadata)) return "Order completed"
  if (parseOrderRefundedMessageMetadata(lastMessage.metadata)) return "Order refunded"
  if (parseOrderExclusiveRepurchaseMessageMetadata(lastMessage.metadata)) return "Buy again"
  const support = parseSupportThreadSystemMessage(lastMessage.content)
  if (support?.kind === "opened") return "Support request"
  if (support?.kind === "status") return "Update from Reswell"
  return null
}

export function formatInboxChatPreviewText(
  lastMessage: InboxConversationRow["messages"][number] | undefined,
  listingTitle: string | undefined,
  currentUserId: string | null,
): string {
  const listing = listingTitle?.trim() ? capitalizeWords(listingTitle.trim()) : ""
  if (lastMessage) {
    const systemHint = systemThreadInboxHint(lastMessage)
    if (systemHint) {
      if (listing) return `${listing} · ${systemHint}`
      return systemHint
    }
  }
  const reviewReq = parseReviewRequestMessageMetadata(lastMessage?.metadata)
  if (reviewReq && lastMessage) {
    const you = lastMessage.sender_id === currentUserId
    const hint = you ? "You asked for a review" : "Asked you for a review"
    if (listing) return `${listing} · ${hint}`
    return hint
  }
  const sharedLoc = parseMessageLocationMetadata(lastMessage?.metadata)
  if (sharedLoc && lastMessage) {
    const you = lastMessage.sender_id === currentUserId
    const hint = you ? "You shared a location" : "Shared a location"
    if (listing) return `${listing} · ${hint}`
    return hint
  }
  const mediaPreview = formatMessageMediaPreviewText({
    metadata: lastMessage?.metadata,
    senderId: lastMessage?.sender_id ?? "",
    currentUserId,
  })
  if (mediaPreview && lastMessage) {
    if (listing) return `${listing} · ${mediaPreview}`
    return mediaPreview
  }
  if (!lastMessage?.content?.trim()) {
    return listing || "No messages yet"
  }
  const body = lastMessage.content.trim()
  const you = lastMessage.sender_id === currentUserId
  const segment = you ? `You · ${body}` : body
  if (listing) return `${listing} · ${segment}`
  return segment
}
