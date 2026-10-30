import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  marketplaceInsertedMessageBroadcasts,
  marketplaceRealtimeBroadcastHttpRequest,
  marketplaceThreadMessageFromRow,
  marketplaceThreadRefreshBroadcasts,
  type MarketplaceRealtimeBroadcast,
} from "@/lib/messages/thread-broadcast"

const BROADCAST_TIMEOUT_MS = 2_000

/**
 * Push one saved message to browsers that have this thread open.
 * Failure is logged and swallowed — the thread reloads on focus if this misses.
 */
export async function broadcastInsertedMarketplaceMessage(
  row: unknown,
  conversationId?: string,
): Promise<void> {
  const message = marketplaceThreadMessageFromRow(row, conversationId)
  if (!message) {
    console.error("[broadcastMarketplaceThread] skipped unusable row", { conversationId })
    return
  }
  const participantIds = await conversationParticipantIds(message.conversation_id)
  await publishMarketplaceBroadcasts(marketplaceInsertedMessageBroadcasts(message, participantIds))
}

/** Offer rewrites and other in-place edits: the open thread reloads once. */
export async function broadcastMarketplaceThreadRefresh(conversationId: string): Promise<void> {
  if (!conversationId) return
  const participantIds = await conversationParticipantIds(conversationId)
  await publishMarketplaceBroadcasts(marketplaceThreadRefreshBroadcasts(conversationId, participantIds))
}

async function conversationParticipantIds(conversationId: string): Promise<string[]> {
  try {
    const service = createServiceRoleClient()
    const { data, error } = await service
      .from("conversations")
      .select("buyer_id, seller_id")
      .eq("id", conversationId)
      .maybeSingle()
    if (error || !data) return []
    return [data.buyer_id, data.seller_id].filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    )
  } catch (error) {
    console.error("[broadcastMarketplaceThread] participants", { conversationId, error })
    return []
  }
}

async function publishMarketplaceBroadcasts(messages: MarketplaceRealtimeBroadcast[]): Promise<void> {
  if (messages.length === 0) return
  const conversationId =
    "conversation_id" in messages[0].payload ? messages[0].payload.conversation_id : ""
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error("[broadcastMarketplaceThread] missing supabase env", { conversationId })
    return
  }

  const request = marketplaceRealtimeBroadcastHttpRequest({
    supabaseUrl,
    messages,
  })

  try {
    const res = await fetch(request.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(BROADCAST_TIMEOUT_MS),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      console.error("[broadcastMarketplaceThread] http", {
        conversationId,
        status: res.status,
        detail: detail.slice(0, 300),
      })
    }
  } catch (error) {
    console.error("[broadcastMarketplaceThread]", { conversationId, error })
  }
}
