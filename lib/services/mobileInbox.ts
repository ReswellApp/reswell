import { mobileInboxSchema, type MobileInbox } from "@reswell/api-contract"
import { revalidateMessagesInboxForUser } from "@/lib/cache/revalidate-messages-inbox"
import { loadInboxTickerCountsForUser } from "@/lib/db/messagesInbox"
import { listingCardImageSrc } from "@/lib/listing-image-display"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import {
  getMessagesInboxForUser,
  markInboxNotificationsReadForUser,
} from "@/lib/services/messagesInbox"
import { inboxTickerCount } from "@/lib/utils/inbox-ticker-count"
import { conversationLastActivityIso } from "@/lib/utils/messages-inbox-grouping"
import {
  inboxActivityNotificationHref,
  offerIdFromInboxNotification,
} from "@/lib/utils/messages-inbox-activity"
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
  const [inbox, ticker] = await Promise.all([
    getMessagesInboxForUser(userId),
    loadInboxTickerCountsForUser(userId),
  ])
  const messages = inbox.conversations.map((conversation) => {
    const buying = conversation.buyer_id === userId
    const other = buying ? conversation.seller : conversation.buyer
    const latest = [...conversation.messages].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
    const listingImage = listingCardImageSrc(conversation.listing?.listing_images)
    const avatar = other?.avatar_url
    const activityAt = conversationLastActivityIso(conversation)
    return {
      id: `message:${conversation.id}`,
      kind: "message" as const,
      title: getPublicSellerDisplayName(other),
      preview: latest?.content?.trim() || conversation.listing?.title || null,
      created_at: activityAt,
      time_label: timeLabel(activityAt),
      unread: conversation.messages.some((message) => !message.is_read && message.sender_id !== userId),
      image_url: mediaUrl(listingImage, false) ?? mediaUrl(avatar, true),
      bucket: buying ? ("buying" as const) : ("selling" as const),
      conversation_id: conversation.id,
      listing_id: conversation.listing_id,
      support_case_id: null,
      href: null,
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
      href: inboxActivityNotificationHref(notification),
      offer_id: offerIdFromInboxNotification(notification),
    }
  })
  const items = [...messages, ...notifications].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  )
  const parsed = mobileInboxSchema.safeParse({
    unread_count: inboxTickerCount(ticker.unreadMessages, ticker.unreadSupport),
    items,
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load your inbox right now" }
  return { ok: true, data: parsed.data }
}

export async function markMobileInboxNotificationReadService(
  userId: string,
  notificationId: string,
): Promise<MobileApiResult<{ notification_id: string; unread: false }>> {
  const result = await markInboxNotificationsReadForUser(userId, notificationId)
  if (!result.ok) {
    const invalid = result.error === "Invalid request"
    return {
      ok: false,
      status: invalid ? 400 : 500,
      error: invalid ? "Invalid notification" : "Unable to update this notification right now",
    }
  }
  revalidateMessagesInboxForUser(userId)
  return { ok: true, data: { notification_id: notificationId, unread: false } }
}
