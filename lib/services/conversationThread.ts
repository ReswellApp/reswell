import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateMessagesInboxForParticipants } from "@/lib/cache/revalidate-messages-inbox"
import { ensureConversationForBuyerSellerListing } from "@/lib/db/conversations"

export type AppendConversationMessageOptions = {
  /** If true, skip insert when the same sender+content already exists on this thread */
  skipIfDuplicate?: boolean
}

/**
 * Ensures the listing-scoped thread for buyer + seller exists and appends a row to `messages`.
 * Accepts any Supabase client (user JWT or service role).
 * When `offerId` is set, dedupes by `(conversation_id, offer_id)` so each offer appears once in Chats.
 */
export async function appendConversationMessageWithClient(
  supabase: SupabaseClient,
  input: {
    buyerId: string
    sellerId: string
    listingId: string
    senderId: string
    content: string
    /** When set, stored on `messages.offer_id` and used for idempotent inserts */
    offerId?: string | null
  },
  options?: AppendConversationMessageOptions,
): Promise<{ ok: true; conversationId: string; inserted: boolean } | { ok: false }> {
  const { buyerId, sellerId, listingId, senderId, content, offerId } = input
  const skipIfDuplicate = options?.skipIfDuplicate ?? false

  const ensured = await ensureConversationForBuyerSellerListing(
    supabase,
    buyerId,
    sellerId,
    listingId,
  )

  if (!ensured) {
    console.error("[appendConversationMessage] ensure conversation failed")
    return { ok: false }
  }

  const conversationId = ensured.id

  if (offerId) {
    const { data: dupOffer } = await supabase
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("offer_id", offerId)
      .maybeSingle()

    if (dupOffer) {
      return { ok: true, conversationId, inserted: false }
    }
  } else if (skipIfDuplicate) {
    const { data: dup } = await supabase
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("sender_id", senderId)
      .eq("content", content)
      .maybeSingle()

    if (dup) {
      return { ok: true, conversationId, inserted: false }
    }
  }

  const { error: msgError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    content,
    offer_id: offerId ?? null,
  })

  if (msgError) {
    console.error("[appendConversationMessage] insert message:", msgError)
    return { ok: false }
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId)

  revalidateMessagesInboxForParticipants(buyerId, sellerId)

  return { ok: true, conversationId, inserted: true }
}

/** User-scoped client (RLS): new offer mirrored into Chats */
export async function appendConversationMessage(
  supabase: SupabaseClient,
  input: {
    buyerId: string
    sellerId: string
    listingId: string
    senderId: string
    content: string
    offerId?: string | null
  },
): Promise<{ ok: true; conversationId: string } | { ok: false }> {
  const r = await appendConversationMessageWithClient(supabase, input)
  if (!r.ok) return { ok: false }
  return { ok: true, conversationId: r.conversationId }
}
