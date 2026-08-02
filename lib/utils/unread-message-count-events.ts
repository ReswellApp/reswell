export const UNREAD_MESSAGE_COUNT_ADJUST_EVENT = "unreadMessageCountAdjust"
export const UNREAD_COUNT_REFRESH_EVENT = "unreadCountRefresh"
export const CONVERSATION_THREAD_OPENED_EVENT = "conversationThreadOpened"
/** Inbox list reconcile after mark-read (separate from header unreadCountRefresh). */
export const MESSAGES_INBOX_REFRESH_EVENT = "messagesInboxRefresh"

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
