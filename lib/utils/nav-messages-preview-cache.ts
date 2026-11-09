import type { MessagesInboxNotification } from "@/lib/db/messagesInbox"
import type { InboxConversationRow } from "@/lib/utils/messages-inbox-grouping"

export type NavMessagesPreviewCacheEntry = {
  conversations: InboxConversationRow[]
  notifications: MessagesInboxNotification[]
  updatedAt: number
}

/** Soft-stale window for hover prefetch — open always revalidates. */
export const NAV_MESSAGES_PREVIEW_STALE_MS = 30_000

const cache = new Map<string, NavMessagesPreviewCacheEntry>()

export function readNavMessagesPreviewCache(
  userId: string,
): NavMessagesPreviewCacheEntry | null {
  return cache.get(userId) ?? null
}

export function writeNavMessagesPreviewCache(
  userId: string,
  entry: {
    conversations: InboxConversationRow[]
    notifications: MessagesInboxNotification[]
  },
): NavMessagesPreviewCacheEntry {
  const next: NavMessagesPreviewCacheEntry = {
    conversations: entry.conversations,
    notifications: entry.notifications,
    updatedAt: Date.now(),
  }
  cache.set(userId, next)
  return next
}

export function patchNavMessagesPreviewCache(
  userId: string,
  patch: (current: NavMessagesPreviewCacheEntry) => {
    conversations: InboxConversationRow[]
    notifications: MessagesInboxNotification[]
  },
): NavMessagesPreviewCacheEntry | null {
  const current = cache.get(userId)
  if (!current) return null
  return writeNavMessagesPreviewCache(userId, patch(current))
}

export function clearNavMessagesPreviewCache(userId?: string): void {
  if (userId) {
    cache.delete(userId)
    return
  }
  cache.clear()
}

export function isNavMessagesPreviewCacheStale(
  entry: NavMessagesPreviewCacheEntry | null | undefined,
  now = Date.now(),
  staleMs = NAV_MESSAGES_PREVIEW_STALE_MS,
): boolean {
  if (!entry) return true
  return now - entry.updatedAt >= staleMs
}
