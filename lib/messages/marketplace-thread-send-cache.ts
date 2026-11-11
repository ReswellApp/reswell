/** Keep in sync with `PENDING_THREAD_MESSAGE_ID_PREFIX`. */
const PENDING_SEND_ID_PREFIX = "pending-"

/**
 * Pending / just-confirmed marketplace sends live here so leaving `/messages`
 * does not drop the bubble or the in-flight POST. The open thread hydrates
 * from this map; a stale RSC snapshot cannot wipe a send that is still running.
 */

export type CachedMarketplaceThreadSendStatus = "sending" | "failed"

export type CachedMarketplaceThreadPreview = {
  url: string
  kind: "image" | "video"
  progress: number
}

export type CachedMarketplaceThreadConfirmed = {
  id: string
  content: string
  sender_id: string
  created_at: string
  is_read?: boolean
  metadata?: unknown
}

export type CachedMarketplaceThreadSend = {
  conversationId: string
  id: string
  content: string
  senderId: string
  createdAt: string
  sendStatus: CachedMarketplaceThreadSendStatus
  localPreview?: CachedMarketplaceThreadPreview
  metadata?: unknown
  confirmed?: CachedMarketplaceThreadConfirmed
}

type ThreadMessageLike = {
  id: string
  content: string
  sender_id: string
  is_read?: boolean
  created_at: string
  sendStatus?: CachedMarketplaceThreadSendStatus
  localPreview?: CachedMarketplaceThreadPreview
  metadata?: unknown
}

const sends = new Map<string, CachedMarketplaceThreadSend>()
const listeners = new Map<string, Set<() => void>>()

function notify(conversationId: string): void {
  const bucket = listeners.get(conversationId)
  if (!bucket) return
  for (const listener of bucket) listener()
}

export function rememberMarketplaceThreadSend(send: CachedMarketplaceThreadSend): void {
  sends.set(send.id, send)
  notify(send.conversationId)
}

export function patchMarketplaceThreadSend(
  clientId: string,
  patch: Partial<Omit<CachedMarketplaceThreadSend, "id" | "conversationId">>,
): void {
  const current = sends.get(clientId)
  if (!current) return
  sends.set(clientId, { ...current, ...patch })
  notify(current.conversationId)
}

export function patchMarketplaceThreadSendProgress(clientId: string, progress: number): void {
  const current = sends.get(clientId)
  if (!current) return
  patchMarketplaceThreadSend(clientId, {
    sendStatus: "sending",
    localPreview: current.localPreview
      ? { ...current.localPreview, progress }
      : current.localPreview,
  })
}

export function confirmMarketplaceThreadSend(
  clientId: string,
  message: CachedMarketplaceThreadConfirmed,
): void {
  const current = sends.get(clientId)
  if (!current) return
  sends.set(clientId, {
    ...current,
    sendStatus: "sending",
    localPreview: undefined,
    confirmed: message,
  })
  notify(current.conversationId)
}

export function forgetMarketplaceThreadSend(clientId: string): void {
  const current = sends.get(clientId)
  if (!current) return
  sends.delete(clientId)
  notify(current.conversationId)
}

export function getMarketplaceThreadSends(conversationId: string): CachedMarketplaceThreadSend[] {
  const rows: CachedMarketplaceThreadSend[] = []
  for (const send of sends.values()) {
    if (send.conversationId === conversationId) rows.push(send)
  }
  return rows
}

export function subscribeMarketplaceThreadSends(
  conversationId: string,
  listener: () => void,
): () => void {
  const bucket = listeners.get(conversationId) ?? new Set<() => void>()
  bucket.add(listener)
  listeners.set(conversationId, bucket)
  return () => {
    const current = listeners.get(conversationId)
    if (!current) return
    current.delete(listener)
    if (current.size === 0) listeners.delete(conversationId)
  }
}

export function pruneMarketplaceThreadSends(
  conversationId: string,
  presentIds: Iterable<string>,
): void {
  const present = presentIds instanceof Set ? presentIds : new Set(presentIds)
  let changed = false
  for (const [clientId, send] of sends) {
    if (send.conversationId !== conversationId) continue
    if (send.confirmed && present.has(send.confirmed.id)) {
      sends.delete(clientId)
      changed = true
    }
  }
  if (changed) notify(conversationId)
}

function cachedToMessage<T extends ThreadMessageLike>(item: CachedMarketplaceThreadSend): T {
  if (item.confirmed) {
    return {
      id: item.confirmed.id,
      content: item.confirmed.content,
      sender_id: item.confirmed.sender_id,
      is_read: item.confirmed.is_read === true,
      created_at: item.confirmed.created_at,
      metadata: item.confirmed.metadata,
    } as T
  }
  return {
    id: item.id,
    content: item.content,
    sender_id: item.senderId,
    is_read: false,
    created_at: item.createdAt,
    sendStatus: item.sendStatus,
    localPreview: item.localPreview,
    metadata: item.metadata,
  } as T
}

/**
 * Overlay module-level pending / just-confirmed sends onto a thread snapshot.
 * Used on remount so clicking out mid-send does not lose the bubble.
 */
export function mergeCachedMarketplaceThreadSends<T extends ThreadMessageLike>(
  messages: T[],
  cached: CachedMarketplaceThreadSend[],
): T[] {
  if (cached.length === 0) {
    const withoutPending = messages.filter(
      (message) => !message.id.startsWith(PENDING_SEND_ID_PREFIX),
    )
    return withoutPending.length === messages.length ? messages : withoutPending
  }

  const confirmedByClientId = new Map<string, CachedMarketplaceThreadSend>()
  const pendingById = new Map<string, CachedMarketplaceThreadSend>()
  const confirmedIds = new Set<string>()
  for (const item of cached) {
    if (item.confirmed) {
      confirmedByClientId.set(item.id, item)
      confirmedIds.add(item.confirmed.id)
    } else {
      pendingById.set(item.id, item)
    }
  }

  const seen = new Set<string>()
  const next: T[] = []

  for (const message of messages) {
    const confirmed = confirmedByClientId.get(message.id)
    if (confirmed?.confirmed) {
      if (seen.has(confirmed.confirmed.id)) continue
      seen.add(confirmed.confirmed.id)
      next.push({
        id: confirmed.confirmed.id,
        content: confirmed.confirmed.content,
        sender_id: confirmed.confirmed.sender_id,
        created_at: confirmed.confirmed.created_at,
        is_read: confirmed.confirmed.is_read === true,
        metadata: confirmed.confirmed.metadata ?? message.metadata,
      } as T)
      continue
    }
    if (
      message.id.startsWith(PENDING_SEND_ID_PREFIX) &&
      !pendingById.has(message.id) &&
      !confirmedByClientId.has(message.id)
    ) {
      continue
    }
    if (confirmedIds.has(message.id)) {
      if (seen.has(message.id)) continue
      seen.add(message.id)
      next.push(message)
      continue
    }
    const pending = pendingById.get(message.id)
    if (pending) {
      if (seen.has(message.id)) continue
      seen.add(message.id)
      next.push({
        ...message,
        content: pending.content || message.content,
        sendStatus: pending.sendStatus,
        localPreview: pending.localPreview ?? message.localPreview,
        metadata: pending.metadata ?? message.metadata,
      })
      continue
    }
    if (seen.has(message.id)) continue
    seen.add(message.id)
    next.push(message)
  }

  for (const item of cached) {
    if (item.confirmed) {
      if (seen.has(item.confirmed.id)) continue
      seen.add(item.confirmed.id)
      next.push(cachedToMessage<T>(item))
      continue
    }
    if (seen.has(item.id)) continue
    seen.add(item.id)
    next.push(cachedToMessage<T>(item))
  }

  return next
}
