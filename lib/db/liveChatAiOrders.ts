/**
 * Scoped order reads for live chat AI — buyer/seller only, safe DTO fields.
 * Do not reuse admin order detail helpers here.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export type LiveChatAiOrderSummary = {
  order_num: string | null
  role: "buyer" | "seller"
  status: string | null
  fulfillment_method: string | null
  delivery_status: string | null
  tracking_number: string | null
  /** Buyer-only when present and fulfillment is pickup. */
  pickup_code: string | null
  listing_title: string | null
  created_at: string | null
}

type OrderRow = {
  id: string
  order_num: string | null
  buyer_id: string | null
  seller_id: string | null
  status: string | null
  fulfillment_method: string | null
  delivery_status: string | null
  tracking_number: string | null
  pickup_code: string | null
  created_at: string | null
  listings: { title: string | null } | { title: string | null }[] | null
}

const ORDER_SELECT = `
  id,
  order_num,
  buyer_id,
  seller_id,
  status,
  fulfillment_method,
  delivery_status,
  tracking_number,
  pickup_code,
  created_at,
  listings ( title )
`

function listingTitle(listings: OrderRow["listings"]): string | null {
  if (!listings) return null
  if (Array.isArray(listings)) return listings[0]?.title?.trim() || null
  return listings.title?.trim() || null
}

function toSummary(row: OrderRow, userId: string): LiveChatAiOrderSummary | null {
  const isBuyer = row.buyer_id === userId
  const isSeller = row.seller_id === userId
  if (!isBuyer && !isSeller) return null

  const role: "buyer" | "seller" = isBuyer ? "buyer" : "seller"
  const fulfillment = row.fulfillment_method?.trim() || null
  const pickupEligible =
    role === "buyer" && (fulfillment === "pickup" || fulfillment === "local_pickup")

  return {
    order_num: row.order_num,
    role,
    status: row.status,
    fulfillment_method: fulfillment,
    delivery_status: row.delivery_status,
    tracking_number: row.tracking_number?.trim() || null,
    pickup_code: pickupEligible ? row.pickup_code?.trim() || null : null,
    listing_title: listingTitle(row.listings),
    created_at: row.created_at,
  }
}

/** Look up a single order the member owns (buyer or seller), by order number. */
export async function lookupLiveChatAiOrderForMember(
  supabase: SupabaseClient,
  userId: string,
  orderNum: string,
): Promise<LiveChatAiOrderSummary | null> {
  const trimmed = orderNum.trim()
  if (!trimmed) return null

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("order_num", trimmed)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .maybeSingle()

  if (error) {
    console.error("[liveChatAiOrders] lookup by order_num", error.message)
    return null
  }
  if (!data) return null
  return toSummary(data as unknown as OrderRow, userId)
}

/** Recent orders for the member when they did not provide an order number. */
export async function listRecentLiveChatAiOrdersForMember(
  supabase: SupabaseClient,
  userId: string,
  limit = 5,
): Promise<LiveChatAiOrderSummary[]> {
  const take = Math.max(1, Math.min(limit, 10))

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(take)

  if (error) {
    console.error("[liveChatAiOrders] list recent", error.message)
    return []
  }

  const rows = (data ?? []) as unknown as OrderRow[]
  return rows
    .map((row) => toSummary(row, userId))
    .filter((row): row is LiveChatAiOrderSummary => row !== null)
}
