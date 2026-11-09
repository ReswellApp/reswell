import type { InboxThreadActivity } from "@/lib/utils/messages-inbox-grouping"

export const UNREAD_MESSAGE_COUNT_ADJUST_EVENT = "unreadMessageCountAdjust"
export const UNREAD_COUNT_REFRESH_EVENT = "unreadCountRefresh"
export const CONVERSATION_THREAD_OPENED_EVENT = "conversationThreadOpened"
/** Inbox list reconcile after mark-read (separate from header unreadCountRefresh). */
export const MESSAGES_INBOX_REFRESH_EVENT = "messagesInboxRefresh"
/** A sent or received message should move its thread to the top of the inbox immediately. */
export const CONVERSATION_INBOX_ACTIVITY_EVENT = "conversationInboxActivity"
/** Saved marketplace message, already authorized for this viewer. Open threads append it. */
export const MARKETPLACE_LIVE_MESSAGE_EVENT = "marketplaceLiveMessage"

export type MarketplaceLiveMessageDetail = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  is_read?: boolean | null
  offer_id?: string | null
  metadata?: unknown
}

export type UnreadMessageCountAdjustDetail = {
  delta: number
}

export type ConversationThreadOpenedDetail = {
  conversationId: string
  /** Inbound unread cleared for this thread (for optimistic inbox row updates). */
  unreadCleared: number
}

/** Optimistically bump the header messages badge (negative delta when messages are read). */
export function dispatchUnreadMessageCountAdjust(delta: number): void {
  if (typeof window === "undefined" || !Number.isFinite(delta) || delta === 0) return
  window.dispatchEvent(
    new CustomEvent<UnreadMessageCountAdjustDetail>(UNREAD_MESSAGE_COUNT_ADJUST_EVENT, {
      detail: { delta },
    }),
  )
}

/** Reconcile the header messages badge against `profiles.unread_message_count`. */
export function dispatchUnreadCountRefresh(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(UNREAD_COUNT_REFRESH_EVENT))
}

/** Re-fetch the `/messages` inbox list after a thread is marked read. */
export function dispatchMessagesInboxRefresh(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(MESSAGES_INBOX_REFRESH_EVENT))
}

/** Append one saved message in any open thread that matches `conversation_id`. */
export function dispatchMarketplaceLiveMessage(message: MarketplaceLiveMessageDetail): void {
  if (typeof window === "undefined" || !message.conversation_id || !message.id) return
  window.dispatchEvent(
    new CustomEvent<MarketplaceLiveMessageDetail>(MARKETPLACE_LIVE_MESSAGE_EVENT, {
      detail: message,
    }),
  )
}

/** Move a marketplace thread to the top of the inbox as soon as its latest message changes. */
export function dispatchConversationInboxActivity(activity: InboxThreadActivity): void {
  if (typeof window === "undefined" || !activity.conversationId) return
  window.dispatchEvent(
    new CustomEvent<InboxThreadActivity>(CONVERSATION_INBOX_ACTIVITY_EVENT, {
      detail: activity,
    }),
  )
}

/**
 * Fired when a marketplace thread mounts / is focused so the header badge and
 * inbox list can clear that conversation's unread state immediately.
 */
export function dispatchConversationThreadOpened(
  conversationId: string,
  unreadCleared: number,
): void {
  if (typeof window === "undefined" || !conversationId) return
  window.dispatchEvent(
    new CustomEvent<ConversationThreadOpenedDetail>(CONVERSATION_THREAD_OPENED_EVENT, {
      detail: {
        conversationId,
        unreadCleared: Number.isFinite(unreadCleared) ? Math.max(0, unreadCleared) : 0,
      },
    }),
  )
}

export function countInboundUnreadMessages(
  messages: ReadonlyArray<{ is_read: boolean; sender_id: string }>,
  currentUserId: string | null | undefined,
): number {
  if (!currentUserId) return 0
  return messages.filter((m) => !m.is_read && m.sender_id !== currentUserId).length
}
