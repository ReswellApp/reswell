import type { MessagesInboxNotification } from "@/lib/db/messagesInbox"
import type { InboxConversationRow } from "@/lib/utils/messages-inbox-grouping"

export type NavMessagesPreviewCacheEntry = {
  conversations: InboxConversationRow[]
  notifications: MessagesInboxNotification[]
  updatedAt: number
}

export type NavMessagesPreviewSnapshot = {
  conversations: InboxConversationRow[]
  notifications: MessagesInboxNotification[]
}

/** Soft-stale window for hover / mount prefetch — open reuses in-flight loads. */
export const NAV_MESSAGES_PREVIEW_STALE_MS = 30_000

/** Enough recent threads for an 8-row counterparty preview after support filtering. */
export const NAV_MESSAGES_PREVIEW_CONVERSATION_LIMIT = 24

export const NAV_MESSAGES_PREVIEW_CACHE_STORAGE_KEY = "reswell.navMessagesPreview.v1"

const MAX_SESSION_BYTES = 180_000

type CacheListener = (
  userId: string,
  entry: NavMessagesPreviewCacheEntry | null,
) => void

const cache = new Map<string, NavMessagesPreviewCacheEntry>()
const listeners = new Set<CacheListener>()
const inflight = new Map<string, Promise<NavMessagesPreviewCacheEntry | null>>()
let sessionHydrated = false

function canUseSessionStorage(): boolean {
  try {
    return typeof globalThis.sessionStorage?.getItem === "function"
  } catch {
    return false
  }
}

function notify(userId: string, entry: NavMessagesPreviewCacheEntry | null): void {
  for (const listener of listeners) {
    listener(userId, entry)
  }
}

function persistSession(): void {
  if (!canUseSessionStorage()) return
  try {
    if (cache.size === 0) {
      globalThis.sessionStorage.removeItem(NAV_MESSAGES_PREVIEW_CACHE_STORAGE_KEY)
      return
    }
    const payload: Record<string, NavMessagesPreviewCacheEntry> = {}
    for (const [userId, entry] of cache) {
      payload[userId] = entry
    }
    const serialized = JSON.stringify(payload)
    if (serialized.length > MAX_SESSION_BYTES) return
    globalThis.sessionStorage.setItem(NAV_MESSAGES_PREVIEW_CACHE_STORAGE_KEY, serialized)
  } catch {
    /* quota / private mode */
  }
}

function hydrateSessionCache(): void {
  if (sessionHydrated) return
  sessionHydrated = true
  if (!canUseSessionStorage()) return
  try {
    const raw = globalThis.sessionStorage.getItem(NAV_MESSAGES_PREVIEW_CACHE_STORAGE_KEY)
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return
    for (const [userId, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (!userId || !entry || typeof entry !== "object") continue
      const record = entry as Partial<NavMessagesPreviewCacheEntry>
      if (!Array.isArray(record.conversations) || !Array.isArray(record.notifications)) continue
      const updatedAt =
        typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
          ? record.updatedAt
          : 0
      cache.set(userId, {
        conversations: record.conversations as InboxConversationRow[],
        notifications: record.notifications as MessagesInboxNotification[],
        updatedAt,
      })
    }
  } catch {
    /* ignore corrupt session JSON */
  }
}

export function subscribeNavMessagesPreviewCache(listener: CacheListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function readNavMessagesPreviewCache(
  userId: string,
): NavMessagesPreviewCacheEntry | null {
  hydrateSessionCache()
  return cache.get(userId) ?? null
}

export function writeNavMessagesPreviewCache(
  userId: string,
  entry: NavMessagesPreviewSnapshot,
): NavMessagesPreviewCacheEntry {
  hydrateSessionCache()
  const next: NavMessagesPreviewCacheEntry = {
    conversations: entry.conversations,
    notifications: entry.notifications,
    updatedAt: Date.now(),
  }
  cache.set(userId, next)
  persistSession()
  notify(userId, next)
  return next
}

export function patchNavMessagesPreviewCache(
  userId: string,
  patch: (current: NavMessagesPreviewCacheEntry) => NavMessagesPreviewSnapshot,
): NavMessagesPreviewCacheEntry | null {
  const current = readNavMessagesPreviewCache(userId)
  if (!current) return null
  return writeNavMessagesPreviewCache(userId, patch(current))
}

export function clearNavMessagesPreviewCache(userId?: string): void {
  hydrateSessionCache()
  if (userId) {
    cache.delete(userId)
    inflight.delete(userId)
    persistSession()
    notify(userId, null)
    return
  }
  const userIds = [...cache.keys()]
  cache.clear()
  inflight.clear()
  sessionHydrated = true
  persistSession()
  for (const id of userIds) notify(id, null)
}

export function isNavMessagesPreviewCacheStale(
  entry: NavMessagesPreviewCacheEntry | null | undefined,
  now = Date.now(),
  staleMs = NAV_MESSAGES_PREVIEW_STALE_MS,
): boolean {
  if (!entry) return true
  return now - entry.updatedAt >= staleMs
}

/**
 * Coalesce header-preview fetches so hover + open + mobile/desktop remount
 * share one in-flight request instead of discarding work mid-flight.
 */
export function loadNavMessagesPreview(
  userId: string,
  fetcher: () => Promise<NavMessagesPreviewSnapshot | null>,
): Promise<NavMessagesPreviewCacheEntry | null> {
  const existing = inflight.get(userId)
  if (existing) return existing

  const promise = (async () => {
    try {
      const fresh = await fetcher()
      if (!fresh) return readNavMessagesPreviewCache(userId)
      return writeNavMessagesPreviewCache(userId, fresh)
    } catch {
      return readNavMessagesPreviewCache(userId)
    } finally {
      inflight.delete(userId)
    }
  })()

  inflight.set(userId, promise)
  return promise
}

/** Test-only: drop memory without touching sessionStorage, so hydrate can re-run. */
export function resetNavMessagesPreviewMemoryForTests(): void {
  cache.clear()
  inflight.clear()
  listeners.clear()
  sessionHydrated = false
}
