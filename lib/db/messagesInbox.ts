import { createServiceRoleClient } from "@/lib/supabase/server"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import {
  filterConversationsWithMessages,
  type InboxConversationRow,
} from "@/lib/utils/messages-inbox-grouping"

export type MessagesInboxActivityListing = {
  id: string
  slug?: string | null
  title: string
  section: string
  price?: number | string | null
  listing_images?: ListingImageForCard[]
}

export type MessagesInboxNotification = {
  id: string
  type: string
  listing_id: string | null
  actor_id: string | null
  message: string | null
  is_read: boolean
  created_at: string
  listings: MessagesInboxActivityListing | null
}

export type MessagesInboxPayload = {
  conversations: InboxConversationRow[]
  notifications: MessagesInboxNotification[]
}

/**
 * Inbox list only needs a per-conversation preview + unread count, so we avoid
 * pulling full message history here. We fetch the latest message inline (ordered
 * + limited at the referenced table) and merge unread incoming messages separately.
 */
const CONVERSATIONS_SELECT = `
  *,
  listing:listings(id, title, listing_images(url, thumbnail_url, is_primary)),
  buyer:profiles!conversations_buyer_id_fkey(id, display_name, avatar_url, shop_verified),
  seller:profiles!conversations_seller_id_fkey(id, display_name, avatar_url, shop_verified),
  messages(id, content, is_read, sender_id, created_at, metadata)
`

/** Hard cap on unread messages fetched for count/preview purposes. */
const MAX_UNREAD_MESSAGES = 2000

const NOTIFICATIONS_SELECT = `
  id,
  type,
  listing_id,
  actor_id,
  message,
  is_read,
  created_at,
  listings(id, slug, title, section, price, listing_images(url, thumbnail_url, is_primary))
`

/** Loads a user's inbox rows (service role; scoped explicitly by userId). */
export async function loadMessagesInboxForUser(userId: string): Promise<MessagesInboxPayload> {
  const supabase = createServiceRoleClient()

  const [{ data: convData, error: convError }, { data: notifData, error: notifError }] =
    await Promise.all([
      supabase
        .from("conversations")
        .select(CONVERSATIONS_SELECT)
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order("last_message_at", { ascending: false })
        .order("created_at", { ascending: false, referencedTable: "messages" })
        .limit(1, { referencedTable: "messages" }),
      supabase
        .from("notifications")
        .select(NOTIFICATIONS_SELECT)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ])

  if (convError) {
    console.error("[loadMessagesInboxForUser] conversations:", convError)
  }
  if (notifError) {
    console.error("[loadMessagesInboxForUser] notifications:", notifError)
  }

  const conversationRows = (convData ?? []) as InboxConversationRow[]

  // Conversations with no messages at all are excluded from the inbox; only the
  // latest message was fetched above, so unread counts are merged in next.
  const conversations = filterConversationsWithMessages(conversationRows)

  await mergeUnreadMessages(supabase, userId, conversations)

  return {
    conversations,
    notifications: (notifData ?? []) as unknown as MessagesInboxNotification[],
  }
}

/**
 * Loads unread incoming messages for the given conversations and merges them
 * into each conversation's `messages` array (alongside the already-loaded latest
 * message), so unread counts stay accurate without loading full history.
 */
async function mergeUnreadMessages(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  conversations: InboxConversationRow[],
): Promise<void> {
  if (conversations.length === 0) return

  const conversationIds = conversations.map((c) => c.id)

  const { data: unreadData, error: unreadError } = await supabase
    .from("messages")
    .select("id, content, is_read, sender_id, created_at, metadata, conversation_id")
    .in("conversation_id", conversationIds)
    .eq("is_read", false)
    .neq("sender_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_UNREAD_MESSAGES)

  if (unreadError) {
    console.error("[loadMessagesInboxForUser] unread messages:", unreadError)
    return
  }

  const unreadByConversation = new Map<string, InboxConversationRow["messages"]>()
  for (const row of (unreadData ?? []) as Array<
    InboxConversationRow["messages"][number] & { conversation_id: string }
  >) {
    const { conversation_id, ...message } = row
    const bucket = unreadByConversation.get(conversation_id) ?? []
    bucket.push(message)
    unreadByConversation.set(conversation_id, bucket)
  }

  for (const conv of conversations) {
    const unread = unreadByConversation.get(conv.id)
    if (!unread?.length) continue

    const seen = new Set(conv.messages.map((m) => m.id).filter(Boolean))
    for (const message of unread) {
      if (message.id && seen.has(message.id)) continue
      conv.messages.push(message)
    }
  }
}
