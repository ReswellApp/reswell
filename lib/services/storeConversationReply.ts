import { createServiceRoleClient } from "@/lib/supabase/server"
import { getStoreStaffRole } from "@/lib/db/consignmentStores"
import { revalidateMessagesInboxForParticipants } from "@/lib/cache/revalidate-messages-inbox"

export type ReplyResult =
  | { ok: true; conversationId: string }
  | { ok: false; error: string; status: number }

/**
 * Staff reply on a store's consignment thread. We post AS the shop (sender_id = seller_id, the shop
 * owner of record) so the buyer always sees a single "shop" counterparty and the two-party
 * conversation model stays intact. The acting staff member is recorded in `messages.metadata` for
 * the shop's own audit trail. Service role is required because non-owner staff are not the
 * conversation's seller and would be blocked by RLS on insert.
 */
export async function replyToStoreConversation(input: {
  staffProfileId: string
  storeId: string
  conversationId: string
  content: string
}): Promise<ReplyResult> {
  const { staffProfileId, storeId, conversationId } = input
  const content = input.content.trim()
  if (!content) {
    return { ok: false, error: "Message cannot be empty.", status: 400 }
  }

  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const role = await getStoreStaffRole(service, storeId, staffProfileId)
  if (!role) {
    return { ok: false, error: "You don't have access to this store's messages.", status: 403 }
  }

  const { data: conv, error: convErr } = await service
    .from("conversations")
    .select("id, buyer_id, seller_id, listing:listings(consignment_store_id)")
    .eq("id", conversationId)
    .maybeSingle()

  if (convErr || !conv) {
    return { ok: false, error: "Conversation not found.", status: 404 }
  }

  const row = conv as {
    id: string
    buyer_id: string
    seller_id: string
    listing: { consignment_store_id: string | null } | null
  }

  if (!row.listing || row.listing.consignment_store_id !== storeId) {
    return { ok: false, error: "This conversation isn't part of your store.", status: 403 }
  }

  // Post as the shop. Record the actual staff member only when they aren't the owner of record.
  const metadata =
    staffProfileId !== row.seller_id ? { sent_by_staff_profile_id: staffProfileId } : null

  const { error: msgErr } = await service.from("messages").insert({
    conversation_id: conversationId,
    sender_id: row.seller_id,
    content,
    metadata,
  })

  if (msgErr) {
    console.error("[storeConversationReply] insert:", msgErr)
    return { ok: false, error: "Could not send your reply.", status: 500 }
  }

  await service
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId)

  revalidateMessagesInboxForParticipants(row.buyer_id, row.seller_id)

  return { ok: true, conversationId }
}
