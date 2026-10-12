import {
  MARKETPLACE_THREAD_MESSAGE_EVENT,
  MARKETPLACE_THREAD_REFRESH_EVENT,
  marketplaceThreadBroadcastHttpRequest,
  marketplaceThreadMessageFromRow,
  type MarketplaceThreadBroadcastMessage,
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
  await publishMarketplaceThreadEvent(message.conversation_id, MARKETPLACE_THREAD_MESSAGE_EVENT, message)
}

/** Offer rewrites and other in-place edits: the open thread reloads once. */
export async function broadcastMarketplaceThreadRefresh(conversationId: string): Promise<void> {
  if (!conversationId) return
  await publishMarketplaceThreadEvent(conversationId, MARKETPLACE_THREAD_REFRESH_EVENT, {
    conversation_id: conversationId,
  })
}

async function publishMarketplaceThreadEvent(
  conversationId: string,
  event: typeof MARKETPLACE_THREAD_MESSAGE_EVENT | typeof MARKETPLACE_THREAD_REFRESH_EVENT,
  payload: MarketplaceThreadBroadcastMessage | { conversation_id: string },
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error("[broadcastMarketplaceThread] missing supabase env", { conversationId })
    return
  }

  const request = marketplaceThreadBroadcastHttpRequest({
    supabaseUrl,
    conversationId,
    event,
    payload,
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
        event,
        status: res.status,
        detail: detail.slice(0, 300),
      })
    }
  } catch (error) {
    console.error("[broadcastMarketplaceThread]", { conversationId, event, error })
  }
}
