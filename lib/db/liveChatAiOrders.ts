/**
 * Scoped order reads for live chat AI — buyer/seller only, safe DTO fields.
 * Do not reuse admin order detail helpers here.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { listingDetailHref } from "@/lib/listing-href"
import { deliveryStatusLabel, orderStatusLabel } from "@/lib/order-status"

export type LiveChatAiOrderRole = "buyer" | "seller"

export type LiveChatAiOrderSummary = {
  order_num: string | null
  role: LiveChatAiOrderRole
  status: string | null
  status_label: string | null
  fulfillment_method: string | null
  delivery_status: string | null
  delivery_status_label: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  /** Buyer-only when present and fulfillment is pickup. */
  pickup_code: string | null
  listing_title: string | null
  listing_href: string | null
  dashboard_href: string
  created_at: string | null
  /** Buyer-only: what they paid (item + shipping). */
  amount_paid: number | null
  /** Seller-only: marketplace earnings for this sale. */
  seller_earnings: number | null
  shipping_amount: number | null
}

type ListingJoin = {
  id?: string | null
  title: string | null
  slug?: string | null
  section?: string | null
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
  tracking_carrier: string | null
  pickup_code: string | null
  created_at: string | null
  amount: string | number | null
  shipping_amount: string | number | null
  seller_earnings: string | number | null
  listing_id: string | null
  listings: ListingJoin | ListingJoin[] | null
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
  tracking_carrier,
  pickup_code,
  created_at,
  amount,
  shipping_amount,
  seller_earnings,
  listing_id,
  listings ( id, title, slug, section )
`

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function listingJoin(listings: OrderRow["listings"]): ListingJoin | null {
  if (!listings) return null
  return Array.isArray(listings) ? listings[0] ?? null : listings
}

function money(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null
  const n = typeof value === "number" ? value : Number.parseFloat(value)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

export function normalizeLiveChatAiOrderRef(value: string): string {
  return value.trim().replace(/^#+\s*/, "")
}

/** Safe DTO for the signed-in member only. Never include the other party's PII. */
export function toLiveChatAiOrderSummary(
  row: OrderRow,
  userId: string,
): LiveChatAiOrderSummary | null {
  const isBuyer = row.buyer_id === userId
  const isSeller = row.seller_id === userId
  if (!isBuyer && !isSeller) return null

  const role: LiveChatAiOrderRole = isBuyer ? "buyer" : "seller"
  const fulfillment = row.fulfillment_method?.trim() || null
  const pickupEligible =
    role === "buyer" && (fulfillment === "pickup" || fulfillment === "local_pickup")
  const listing = listingJoin(row.listings)
  const listingId = listing?.id?.trim() || row.listing_id
  const status = row.status?.trim() || null
  const delivery = row.delivery_status?.trim() || null

  return {
    order_num: row.order_num,
    role,
    status,
    status_label: status ? orderStatusLabel(status) : null,
    fulfillment_method: fulfillment,
    delivery_status: delivery,
    delivery_status_label: delivery ? deliveryStatusLabel(delivery) : null,
    tracking_number: row.tracking_number?.trim() || null,
    tracking_carrier: row.tracking_carrier?.trim() || null,
    pickup_code: pickupEligible ? row.pickup_code?.trim() || null : null,
    listing_title: listing?.title?.trim() || null,
    listing_href: listingId
      ? listingDetailHref({
          id: listingId,
          slug: listing?.slug,
          section: listing?.section ?? undefined,
        })
      : null,
    dashboard_href:
      role === "buyer" ? `/dashboard/purchases/${row.id}` : `/dashboard/sales/${row.id}`,
    created_at: row.created_at,
    amount_paid: role === "buyer" ? money(row.amount) : null,
    seller_earnings: role === "seller" ? money(row.seller_earnings) : null,
    shipping_amount: money(row.shipping_amount),
  }
}

export function splitLiveChatAiOrdersByRole(orders: LiveChatAiOrderSummary[]): {
  purchases: LiveChatAiOrderSummary[]
  sales: LiveChatAiOrderSummary[]
} {
  return {
    purchases: orders.filter((order) => order.role === "buyer"),
    sales: orders.filter((order) => order.role === "seller"),
  }
}

/** Look up a single order the member owns (buyer or seller), by order number or id. */
export async function lookupLiveChatAiOrderForMember(
  supabase: SupabaseClient,
  userId: string,
  orderRef: string,
): Promise<LiveChatAiOrderSummary | null> {
  const trimmed = normalizeLiveChatAiOrderRef(orderRef)
  if (!trimmed) return null

  let query = supabase
    .from("orders")
    .select(ORDER_SELECT)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)

  query = UUID_RE.test(trimmed) ? query.eq("id", trimmed) : query.eq("order_num", trimmed)

  const { data, error } = await query.maybeSingle()

  if (error) {
    console.error("[liveChatAiOrders] lookup by order ref", error.message)
    return null
  }
  if (!data) return null
  return toLiveChatAiOrderSummary(data as unknown as OrderRow, userId)
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
    .map((row) => toLiveChatAiOrderSummary(row, userId))
    .filter((row): row is LiveChatAiOrderSummary => row !== null)
}
