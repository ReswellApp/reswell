import {
  parseMarketplaceMessageImageAttachment,
  parseMarketplaceMessageVideoAttachment,
} from "@/lib/validations/marketplace-message-attachment"

export function formatMessageMediaPreviewText(input: {
  metadata: unknown
  senderId: string
  currentUserId: string | null
}): string | null {
  const image = parseMarketplaceMessageImageAttachment(input.metadata)
  if (image) {
    return input.senderId === input.currentUserId ? "You sent a photo" : "Sent a photo"
  }

  const video = parseMarketplaceMessageVideoAttachment(input.metadata)
  if (video) {
    return input.senderId === input.currentUserId ? "You sent a video" : "Sent a video"
  }

  return null
}
