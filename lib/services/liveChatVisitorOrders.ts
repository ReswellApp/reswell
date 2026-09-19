import type { SupabaseClient } from "@supabase/supabase-js"
import type { LiveChatSessionRow } from "@/lib/db/liveChat"
import {
  listLiveChatVisitorOrderTilesForMember,
  type LiveChatVisitorOrderTile,
} from "@/lib/db/liveChatVisitorOrders"

export type { LiveChatVisitorOrderTile }

export type LiveChatVisitorOrderTilesBootstrap = {
  orders: LiveChatVisitorOrderTile[]
  authRequired: boolean
}

export async function listLiveChatVisitorOrderTiles(params: {
  svc: SupabaseClient
  session: LiveChatSessionRow
}): Promise<LiveChatVisitorOrderTilesBootstrap> {
  const userId = params.session.user_id
  if (!userId) {
    return { orders: [], authRequired: true }
  }

  const orders = await listLiveChatVisitorOrderTilesForMember(params.svc, userId)
  return { orders, authRequired: false }
}
