import { revalidateTag } from "next/cache"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { messagesInboxTag } from "@/lib/cache/messages-inbox"

const EXPIRE_NOW = { expire: 0 } as const

export function revalidateMessagesInboxForParticipants(
  buyerId: string,
  sellerId: string,
): void {
  // Expire immediately. "max" serves the previous list while revalidating, so a
  // new reply stays buried and an opened thread keeps its unread bubble.
  revalidateTag(messagesInboxTag(buyerId), EXPIRE_NOW)
  revalidateTag(messagesInboxTag(sellerId), EXPIRE_NOW)
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
