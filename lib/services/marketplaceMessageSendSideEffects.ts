import type { SupabaseClient } from "@supabase/supabase-js"
import { after } from "next/server"
import { revalidateMessagesInboxForParticipants } from "@/lib/cache/revalidate-messages-inbox"
import { trackKlaviyoMessageSentNow } from "@/lib/klaviyo/track-message-sent"
import { broadcastInsertedMarketplaceMessage } from "@/lib/services/broadcastMarketplaceThreadMessage"

type InsertedMarketplaceMessage = {
  id: string
  content: string
  sender_id: string
  created_at: string
  is_read?: boolean
  metadata?: unknown
}

/**
 * The row is already in `messages`. Fan-out, inbox cache, and analytics must not
 * hold the sender's Server Action open — iMessage-style send returns on persist.
 *
 * Klaviyo Message Sent is awaited inside this `after()` callback (not nested via
 * another `after`) so SMS opt-in delivery is not dropped when the invocation ends.
 */
export function scheduleMarketplaceMessageSendSideEffects(input: {
  inserted: InsertedMarketplaceMessage
  conversationId: string
  buyerId: string
  sellerId: string
  receiverId: string
  listingId: string | null
  writeDb: SupabaseClient
  senderEmail: string | null
  afterPersist?: () => Promise<void>
}): void {
  const run = async () => {
    await broadcastInsertedMarketplaceMessage(input.inserted, input.conversationId)
    await input.writeDb
      .from("conversations")
      .update({ last_message_at: input.inserted.created_at })
      .eq("id", input.conversationId)
    revalidateMessagesInboxForParticipants(input.buyerId, input.sellerId)

    const { data: senderProfile } = await input.writeDb
      .from("profiles")
      .select("display_name, shop_name, is_shop")
      .eq("id", input.inserted.sender_id)
      .maybeSingle()

    await trackKlaviyoMessageSentNow({
      senderUserId: input.inserted.sender_id,
      receiverUserId: input.receiverId,
      message: input.inserted.content,
      conversationId: input.conversationId,
      listingId: input.listingId,
      messageId: input.inserted.id,
      sentAt: input.inserted.created_at,
      sessionSender: {
        email: input.senderEmail,
        profile: senderProfile,
      },
    })

    if (input.afterPersist) {
      await input.afterPersist()
    }
  }

  const work = () =>
    run().catch((error) => {
      console.error("[marketplace-message-send] side effects:", error)
    })

  try {
    after(work)
  } catch {
    void work()
  }
}
