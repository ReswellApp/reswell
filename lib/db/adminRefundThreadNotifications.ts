import type { SupabaseClient } from "@supabase/supabase-js"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import { parseOrderRefundedMessageMetadata } from "@/lib/validations/order-refunded-message-metadata"

export type AdminRefundThreadNotificationStats = {
  totalSent: number
  uniqueSellersNotified: number
  uniqueOrdersCovered: number
  refundedOrdersTotal: number
  coverageGap: number
  last7Days: number
}

type MessageListRow = {
  id: string
  created_at: string
  metadata: unknown
  conversation_id: string
  conversations: {
    buyer_id: string
    seller_id: string
    listing_id: string | null
  } | null
}

export type AdminRefundThreadNotificationListItem = {
  messageId: string
  sentAt: string
  conversationId: string
  orderId: string
  orderNum: string
  listingTitle: string
  listingTitles?: string[]
  buyerId: string
  sellerId: string
}

export async function dbGetAdminRefundThreadNotificationStats(
  supabase: SupabaseClient,
): Promise<{ data: AdminRefundThreadNotificationStats | null; error: Error | null }> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalSent, error: totalErr },
    { count: last7Days, error: last7Err },
    { data: messageRows, error: messagesErr },
    { count: refundedOrdersTotal, error: refundedErr },
  ] = await Promise.all([
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .contains("metadata", { kind: "order_refunded" }),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .contains("metadata", { kind: "order_refunded" })
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("messages")
      .select("metadata, conversations ( seller_id )")
      .contains("metadata", { kind: "order_refunded" })
      .limit(5000),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "refunded")
      .match(REAL_MARKETPLACE_SALES_FILTER),
  ])

  const err = totalErr ?? last7Err ?? messagesErr ?? refundedErr
  if (err) {
    return { data: null, error: err }
  }

  const orderIds = new Set<string>()
  const sellerIds = new Set<string>()

  for (const row of messageRows ?? []) {
    const parsed = parseOrderRefundedMessageMetadata((row as { metadata?: unknown }).metadata)
    if (parsed?.orderId) orderIds.add(parsed.orderId)

    const conv = (row as { conversations?: { seller_id?: string } | null }).conversations
    if (typeof conv?.seller_id === "string" && conv.seller_id.length > 0) {
      sellerIds.add(conv.seller_id)
    }
  }

  const totalSentNum = totalSent ?? 0
  const refundedTotal = refundedOrdersTotal ?? 0

  return {
    data: {
      totalSent: totalSentNum,
      uniqueSellersNotified: sellerIds.size,
      uniqueOrdersCovered: orderIds.size,
      refundedOrdersTotal: refundedTotal,
      coverageGap: Math.max(0, refundedTotal - orderIds.size),
      last7Days: last7Days ?? 0,
    },
    error: null,
  }
}

export async function dbListAdminRefundThreadNotifications(
  supabase: SupabaseClient,
  opts: { limit: number; offset: number; q?: string; userId?: string },
): Promise<{
  data: AdminRefundThreadNotificationListItem[]
  total: number
  error: Error | null
}> {
  let query = supabase
    .from("messages")
    .select(
      `
      id,
      created_at,
      metadata,
      conversation_id,
      conversations!inner (
        buyer_id,
        seller_id,
        listing_id
      )
    `,
      { count: "exact" },
    )
    .contains("metadata", { kind: "order_refunded" })
    .order("created_at", { ascending: false })

  if (opts.userId) {
    query = query.or(
      `buyer_id.eq.${opts.userId},seller_id.eq.${opts.userId}`,
      { foreignTable: "conversations" },
    )
  }

  const term = opts.q?.trim()
  if (term) {
    const uuidLike = /^[0-9a-f-]{36}$/i.test(term)
    if (uuidLike) {
      query = query.filter("metadata->>orderId", "eq", term)
    } else {
      query = query.ilike("metadata->>orderNum", `%${term}%`)
    }
  }

  const { data, error, count } = await query.range(opts.offset, opts.offset + opts.limit - 1)

  if (error) {
    return { data: [], total: 0, error }
  }

  const items: AdminRefundThreadNotificationListItem[] = []

  for (const row of (data ?? []) as MessageListRow[]) {
    const parsed = parseOrderRefundedMessageMetadata(row.metadata)
    const conv = row.conversations
    if (!parsed || !conv?.buyer_id || !conv?.seller_id) continue

    items.push({
      messageId: row.id,
      sentAt: row.created_at,
      conversationId: row.conversation_id,
      orderId: parsed.orderId,
      orderNum: parsed.orderNum,
      listingTitle: parsed.listingTitle,
      listingTitles: parsed.listingTitles,
      buyerId: conv.buyer_id,
      sellerId: conv.seller_id,
    })
  }

  return { data: items, total: count ?? items.length, error: null }
}
