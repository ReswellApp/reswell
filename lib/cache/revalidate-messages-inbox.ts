import { revalidateTag } from "next/cache"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { messagesInboxTag } from "@/lib/cache/messages-inbox"

export function revalidateMessagesInboxForParticipants(
  buyerId: string,
  sellerId: string,
): void {
  revalidateTag(messagesInboxTag(buyerId))
  revalidateTag(messagesInboxTag(sellerId))
}

/** When only `conversationId` is known (support/system inserts). */
export async function revalidateMessagesInboxForConversationId(
  conversationId: string,
): Promise<void> {
  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("conversations")
      .select("buyer_id, seller_id")
      .eq("id", conversationId)
      .maybeSingle()

    if (error || !data?.buyer_id || !data?.seller_id) {
      return
    }

    revalidateMessagesInboxForParticipants(
      data.buyer_id as string,
      data.seller_id as string,
    )
  } catch {
    // Service role unavailable locally — cache refresh skipped.
  }
}
