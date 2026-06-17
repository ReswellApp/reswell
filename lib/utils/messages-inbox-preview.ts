import { capitalizeWords } from "@/lib/listing-labels"
import { formatMessageMediaPreviewText } from "@/lib/utils/message-media-preview-text"
import { parseMessageLocationMetadata } from "@/lib/validations/message-location-metadata"
import { parseReviewRequestMessageMetadata } from "@/lib/validations/review-request-message-metadata"
import type { InboxConversationRow } from "@/lib/utils/messages-inbox-grouping"

export function formatInboxChatPreviewText(
  lastMessage: InboxConversationRow["messages"][number] | undefined,
  listingTitle: string | undefined,
  currentUserId: string | null,
): string {
  const listing = listingTitle?.trim() ? capitalizeWords(listingTitle.trim()) : ""
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
