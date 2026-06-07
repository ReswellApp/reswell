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

const CONVERSATIONS_SELECT = `
  *,
  listing:listings(id, title, listing_images(url, thumbnail_url, is_primary)),
  buyer:profiles!conversations_buyer_id_fkey(id, display_name, avatar_url, shop_verified),
  seller:profiles!conversations_seller_id_fkey(id, display_name, avatar_url, shop_verified),
  messages(content, is_read, sender_id, created_at, metadata)
`

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
        .order("created_at", { ascending: true, referencedTable: "messages" }),
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

  const conversations = filterConversationsWithMessages(
    (convData ?? []) as InboxConversationRow[],
  )

  return {
    conversations,
    notifications: (notifData ?? []) as unknown as MessagesInboxNotification[],
  }
}
