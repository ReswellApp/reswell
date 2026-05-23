import type { ListingImageForCard } from "@/lib/listing-image-display"

export type InboxConversationMessage = {
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

/** One inbox row per counterparty; threads sorted newest listing activity first. */
export function groupConversationsByCounterparty(
  conversations: InboxConversationRow[],
  currentUserId: string | null,
): CounterpartyInboxGroup[] {
  const byUser = new Map<string, InboxConversationRow[]>()

  for (const conv of conversations) {
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
