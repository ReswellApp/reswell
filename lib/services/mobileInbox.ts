import { mobileInboxSchema, type MobileInbox } from "@reswell/api-contract"
import { listingCardImageSrc } from "@/lib/listing-image-display"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { getMessagesInboxForUser } from "@/lib/services/messagesInbox"
import { absoluteProxiedProfileMediaUrl } from "@/lib/public-media-display-src"
import { absolutePublicMediaUrl } from "@/lib/site-metadata"
import { getPublicSellerDisplayName } from "@/lib/listing-labels"
import type { MessagesInboxNotification } from "@/lib/db/messagesInbox"

function timeLabel(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ""
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000))
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return `${Math.floor(days / 7)}w`
}

function mediaUrl(src: string | null | undefined, profile: boolean): string | null {
  if (!src) return null
  const absolute = profile ? absoluteProxiedProfileMediaUrl(src) : absolutePublicMediaUrl(src)
  return absolute ?? null
}

function notificationTitle(notification: MessagesInboxNotification): string {
  return notification.listings?.title?.trim() || notification.support_subject?.trim() || "Notification"
}

export async function getMobileInboxService(userId: string): Promise<MobileApiResult<MobileInbox>> {
  const inbox = await getMessagesInboxForUser(userId)
  const messages = inbox.conversations.map((conversation) => {
    const buying = conversation.buyer_id === userId
    const other = buying ? conversation.seller : conversation.buyer
    const latest = [...conversation.messages].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
    const listingImage = listingCardImageSrc(conversation.listing?.listing_images)
    const avatar = other?.avatar_url
    return {
      id: `message:${conversation.id}`,
      kind: "message" as const,
      title: getPublicSellerDisplayName(other),
      preview: latest?.content?.trim() || conversation.listing?.title || null,
      created_at: conversation.last_message_at,
      time_label: timeLabel(conversation.last_message_at),
      unread: conversation.messages.some((message) => !message.is_read && message.sender_id !== userId),
      image_url: mediaUrl(listingImage, false) ?? mediaUrl(avatar, true),
      bucket: buying ? ("buying" as const) : ("selling" as const),
      conversation_id: conversation.id,
      listing_id: conversation.listing_id,
      support_case_id: null,
    }
  })
  const notifications = inbox.notifications.map((notification) => {
    const image = listingCardImageSrc(notification.listings?.listing_images)
    return {
      id: `notification:${notification.id}`,
      kind: "notification" as const,
      title: notificationTitle(notification),
      preview: notification.message?.trim() || null,
      created_at: notification.created_at,
      time_label: timeLabel(notification.created_at),
      unread: !notification.is_read,
      image_url: mediaUrl(image, false),
      bucket: "activity" as const,
      conversation_id: null,
      listing_id: notification.listing_id,
      support_case_id: notification.support_case_id ?? null,
    }
  })
  const items = [...messages, ...notifications].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  )
  const parsed = mobileInboxSchema.safeParse({
    unread_count: items.filter((item) => item.unread).length,
    items,
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load your inbox right now" }
  return { ok: true, data: parsed.data }
}
