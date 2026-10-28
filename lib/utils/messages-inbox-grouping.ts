import type { ListingImageForCard } from "@/lib/listing-image-display"

export type InboxConversationMessage = {
  id?: string
  content: string
  is_read: boolean
  sender_id: string
  created_at: string
  metadata?: unknown | null
}

export type InboxConversationListing = {
  id: string
  title: string
  listing_images?: ListingImageForCard[]
}

export type InboxConversationRow = {
  id: string
  listing_id: string | null
  buyer_id: string
  seller_id: string
  last_message_at: string
  listing: InboxConversationListing | null
  buyer: {
    id: string
    display_name: string
    avatar_url: string | null
    shop_verified?: boolean
  }
  seller: {
    id: string
    display_name: string
    avatar_url: string | null
    shop_verified?: boolean
  }
  messages: InboxConversationMessage[]
}

export type CounterpartyInboxGroup = {
  otherUserId: string
  otherUser: InboxConversationRow["buyer"]
  threads: InboxConversationRow[]
  latestActivityMs: number
  totalUnread: number
  latestMessage: InboxConversationMessage | undefined
  /** Most recently active listing thread (for preview context). */
  primaryThread: InboxConversationRow
}

export function getOtherUserIdFromConversation(
  conv: Pick<InboxConversationRow, "buyer_id" | "seller_id">,
  currentUserId: string,
): string {
  return conv.buyer_id === currentUserId ? conv.seller_id : conv.buyer_id
}

export function conversationHasMessages(
  conv: Pick<InboxConversationRow, "messages">,
): boolean {
  return (conv.messages?.length ?? 0) > 0
}

export function filterConversationsWithMessages(
  conversations: InboxConversationRow[],
): InboxConversationRow[] {
  return conversations.filter(conversationHasMessages)
}

/**
 * Member↔Reswell Support ticket DMs use `listing_id: null` with the member as
 * `buyer_id` and the configured support user as `seller_id`. Those belong under
 * `/dashboard/support`, not the marketplace `/messages` inbox.
 *
 * Staff-outbound marketplace DMs (admin/employee messaging a member) use the
 * opposite orientation (`buyer_id` = staff). Those must stay in `/messages` —
 * matching either participant here previously hid them and orphaned deep links.
 */
export function isSupportInboxConversation(
  conv: Pick<InboxConversationRow, "listing_id" | "buyer_id" | "seller_id">,
  supportUserId: string | null | undefined,
): boolean {
  if (!supportUserId) return false
  if (conv.listing_id != null) return false
  return conv.seller_id === supportUserId
}

export function filterOutSupportInboxConversations(
  conversations: InboxConversationRow[],
  supportUserId: string | null | undefined,
): InboxConversationRow[] {
  if (!supportUserId) return conversations
  return conversations.filter((c) => !isSupportInboxConversation(c, supportUserId))
}

export function getLatestMessage(conv: InboxConversationRow): InboxConversationMessage | undefined {
  if (!conv.messages?.length) return undefined
  return [...conv.messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  ).at(-1)
}

export function getConversationLastActivityMs(conv: InboxConversationRow): number {
  let maxMs = 0
  const fromConv = new Date(conv.last_message_at).getTime()
  if (Number.isFinite(fromConv)) maxMs = fromConv
  for (const m of conv.messages ?? []) {
    const t = new Date(m.created_at).getTime()
    if (Number.isFinite(t) && t > maxMs) maxMs = t
  }
  return maxMs
}

export function getUnreadCountForConversation(
  conv: InboxConversationRow,
  currentUserId: string | null,
): number {
  return conv.messages.filter((m) => !m.is_read && m.sender_id !== currentUserId).length
}

export type InboxThreadActivity = {
  conversationId: string
  at: string
  message?: InboxConversationMessage
}

/** Newest of the conversation timestamp and the loaded message times. */
export function conversationLastActivityIso(conv: InboxConversationRow): string {
  const ms = getConversationLastActivityMs(conv)
  if (!Number.isFinite(ms) || ms <= 0) return conv.last_message_at
  return new Date(ms).toISOString()
}

function laterIso(current: string, next: string | undefined): string {
  if (!next) return current
  const currentMs = new Date(current).getTime()
  const nextMs = new Date(next).getTime()
  if (!Number.isFinite(nextMs)) return current
  if (!Number.isFinite(currentMs) || nextMs >= currentMs) return next
  return current
}

/**
 * Once a message is read in this session, a stale refetch must not turn it
 * unread again. A brand-new incoming row still arrives unread.
 */
function upsertInboxMessage(
  messages: InboxConversationMessage[],
  incoming: InboxConversationMessage,
): InboxConversationMessage[] {
  const id = incoming.id
  if (!id) return [...messages, incoming]
  const index = messages.findIndex((message) => message.id === id)
  if (index < 0) return [...messages, incoming]
  const existing = messages[index]
  if (!existing) return messages
  const isRead = existing.is_read || incoming.is_read
  if (
    existing.is_read === isRead &&
    existing.content === incoming.content &&
    existing.created_at === incoming.created_at &&
    existing.sender_id === incoming.sender_id
  ) {
    return messages
  }
  const next = messages.slice()
  next[index] = { ...existing, ...incoming, is_read: isRead }
  return next
}

function applyActivityToConversation(
  conv: InboxConversationRow,
  activity: InboxThreadActivity,
): InboxConversationRow {
  let lastMessageAt = laterIso(conv.last_message_at, activity.at)
  let messages = conv.messages
  if (activity.message) {
    lastMessageAt = laterIso(lastMessageAt, activity.message.created_at)
    messages = upsertInboxMessage(messages, activity.message)
  }
  if (lastMessageAt === conv.last_message_at && messages === conv.messages) return conv
  return { ...conv, last_message_at: lastMessageAt, messages }
}

/** Move one thread to the front of the inbox as soon as a message is sent or received. */
export function applyInboxThreadActivity(
  conversations: InboxConversationRow[],
  activity: InboxThreadActivity,
): InboxConversationRow[] {
  if (!activity.conversationId) return conversations
  let changed = false
  const next = conversations.map((conv) => {
    if (conv.id !== activity.conversationId) return conv
    const updated = applyActivityToConversation(conv, activity)
    if (updated !== conv) changed = true
    return updated
  })
  return changed ? next : conversations
}

function mergeInboxConversationRow(
  local: InboxConversationRow,
  incoming: InboxConversationRow,
): InboxConversationRow {
  const lastMessageAt = laterIso(incoming.last_message_at, local.last_message_at)
  let messages = incoming.messages
  for (const message of local.messages) {
    messages = upsertInboxMessage(messages, message)
  }
  if (lastMessageAt === incoming.last_message_at && messages === incoming.messages) return incoming
  return { ...incoming, last_message_at: lastMessageAt, messages }
}

/**
 * Fold a server inbox snapshot over local state.
 * Membership follows the server. A newer local reply stays on top, and a
 * message already marked read stays read if the snapshot is stale.
 */
export function mergeInboxConversationSnapshots(
  current: InboxConversationRow[],
  incoming: InboxConversationRow[],
): InboxConversationRow[] {
  if (current.length === 0) return incoming
  const currentById = new Map(current.map((row) => [row.id, row]))
  return incoming.map((row) => {
    const local = currentById.get(row.id)
    return local ? mergeInboxConversationRow(local, row) : row
  })
}

/** Realtime `messages` row → inbox activity, or null when the payload is incomplete. */
export function inboxActivityFromMessageRow(
  row: Record<string, unknown> | null | undefined,
): InboxThreadActivity | null {
  if (!row) return null
  const conversationId = typeof row.conversation_id === "string" ? row.conversation_id : ""
  const createdAt = typeof row.created_at === "string" ? row.created_at : ""
  const senderId = typeof row.sender_id === "string" ? row.sender_id : ""
  if (!conversationId || !createdAt || !senderId) return null
  return {
    conversationId,
    at: createdAt,
    message: {
      id: typeof row.id === "string" ? row.id : undefined,
      content: typeof row.content === "string" ? row.content : "",
      is_read: row.is_read === true,
      sender_id: senderId,
      created_at: createdAt,
      metadata: "metadata" in row ? row.metadata : null,
    },
  }
}

/** Mark inbound messages in one conversation as read (optimistic inbox patch). */
export function markConversationMessagesReadLocally(
  conversations: InboxConversationRow[],
  conversationId: string,
  currentUserId: string | null,
): InboxConversationRow[] {
  if (!currentUserId) return conversations
  let changed = false
  const next = conversations.map((conv) => {
    if (conv.id !== conversationId) return conv
    let rowChanged = false
    const messages = conv.messages.map((m) => {
      if (m.is_read || m.sender_id === currentUserId) return m
      rowChanged = true
      return { ...m, is_read: true }
    })
    if (!rowChanged) return conv
    changed = true
    return { ...conv, messages }
  })
  return changed ? next : conversations
}

/** One inbox row per counterparty; threads sorted newest listing activity first. */
export function groupConversationsByCounterparty(
  conversations: InboxConversationRow[],
  currentUserId: string | null,
): CounterpartyInboxGroup[] {
  const byUser = new Map<string, InboxConversationRow[]>()

  for (const conv of filterConversationsWithMessages(conversations)) {
    if (!currentUserId) continue
    const otherUserId = getOtherUserIdFromConversation(conv, currentUserId)
    const bucket = byUser.get(otherUserId) ?? []
    bucket.push(conv)
    byUser.set(otherUserId, bucket)
  }

  const groups: CounterpartyInboxGroup[] = []

  for (const [otherUserId, threads] of byUser) {
    const sortedThreads = [...threads].sort(
      (a, b) => getConversationLastActivityMs(b) - getConversationLastActivityMs(a),
    )
    const primaryThread = sortedThreads[0]
    if (!primaryThread) continue

    const otherUser =
      primaryThread.buyer_id === currentUserId ? primaryThread.seller : primaryThread.buyer

    const latestMessage = sortedThreads
      .map(getLatestMessage)
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(b!.created_at).getTime() - new Date(a!.created_at).getTime(),
      )[0]

    groups.push({
      otherUserId,
      otherUser,
      threads: sortedThreads,
      latestActivityMs: Math.max(...sortedThreads.map(getConversationLastActivityMs)),
      totalUnread: sortedThreads.reduce(
        (sum, t) => sum + getUnreadCountForConversation(t, currentUserId),
        0,
      ),
      latestMessage,
      primaryThread,
    })
  }

  return groups.sort((a, b) => b.latestActivityMs - a.latestActivityMs)
}

export function counterpartyInboxHref(group: CounterpartyInboxGroup): string {
  if (group.threads.length === 1) {
    return `/messages/${group.primaryThread.id}`
  }
  return `/messages/with/${group.otherUserId}`
}
