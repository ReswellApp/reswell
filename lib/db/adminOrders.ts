import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import { getConversationForBuyerSellerListing } from "@/lib/db/conversations"

export type AdminOrderShippingAddress = {
  name?: string | null
  phone?: string | null
  email?: string | null
  admin_terminal?: boolean
  address?: {
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postal_code?: string | null
    country?: string | null
  } | null
} | null

export type AdminOrderParticipant = {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  city: string | null
  state: string | null
  bio: string | null
  created_at: string | null
  sales_count: number | null
  shop_name: string | null
  is_shop: boolean | null
  shop_verified: boolean | null
  seller_slug: string | null
  shop_phone: string | null
  shop_address: string | null
}

export type AdminOrderLineItem = {
  listing_id: string
  title: string | null
  sort_order: number | null
}

export type AdminOrderDetail = {
  id: string
  order_num: string | null
  status: string
  amount: number
  /** Listing price portion of `amount` — the money that flows to the seller (minus platform fee). */
  item_price: number
  /** Buyer-paid shipping included in `amount`. Excluded from platform fee + seller earnings. */
  shipping_amount: number
  platform_fee: number
  seller_earnings: number
  promo_discount_usd: number
  payment_method: string
  fulfillment_method: string | null
  created_at: string
  refunded_at: string | null
  buyer_id: string | null
  seller_id: string
  listing_id: string
  listing_title: string | null
  buyer: AdminOrderParticipant
  seller: AdminOrderParticipant
  shipping_address: AdminOrderShippingAddress
  order_items: AdminOrderLineItem[]
  stripe_checkout_session_id: string | null
  delivery_status: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  carrier_delivered_at: string | null
  /** Listing-scoped buyer↔seller thread for this order, when one exists. */
  conversation_id: string | null
  marketplace_message_count: number
  /** Matching payouts row when present — shipping uses held → pending after carrier delivery + 24h hold. */
  payout: { status: string; hold_reason: string | null; released_at: string | null } | null
  sales_channel: string | null
}

const ADMIN_ORDER_PARTICIPANT_SELECT =
  "id, email, display_name, avatar_url, city, state, bio, created_at, sales_count, shop_name, is_shop, shop_verified, seller_slug, shop_phone, shop_address"

function num(v: string | number | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function unwrapRelation<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

function mapGuestBuyerFromShippingAddress(
  ship: AdminOrderShippingAddress,
): AdminOrderParticipant {
  return {
    id: "guest",
    email: ship?.email?.trim() || null,
    display_name: ship?.name?.trim() || "Walk-in customer",
    avatar_url: null,
    city: null,
    state: null,
    bio: null,
    created_at: null,
    sales_count: null,
    shop_name: null,
    is_shop: null,
    shop_verified: null,
    seller_slug: null,
    shop_phone: ship?.phone?.trim() || null,
    shop_address: null,
  }
}

function mapAdminOrderParticipant(
  userId: string,
  row: Record<string, unknown> | null,
): AdminOrderParticipant {
  return {
    id: userId,
    email: typeof row?.email === "string" ? row.email : null,
    display_name: typeof row?.display_name === "string" ? row.display_name : null,
    avatar_url: typeof row?.avatar_url === "string" ? row.avatar_url : null,
    city: typeof row?.city === "string" ? row.city : null,
    state: typeof row?.state === "string" ? row.state : null,
    bio: typeof row?.bio === "string" ? row.bio : null,
    created_at: typeof row?.created_at === "string" ? row.created_at : null,
    sales_count:
      row?.sales_count == null ? null : num(row.sales_count as string | number),
    shop_name: typeof row?.shop_name === "string" ? row.shop_name : null,
    is_shop: typeof row?.is_shop === "boolean" ? row.is_shop : null,
    shop_verified: typeof row?.shop_verified === "boolean" ? row.shop_verified : null,
    seller_slug: typeof row?.seller_slug === "string" ? row.seller_slug : null,
    shop_phone: typeof row?.shop_phone === "string" ? row.shop_phone : null,
    shop_address: typeof row?.shop_address === "string" ? row.shop_address : null,
  }
}

function parseAdminOrderLineItems(raw: unknown): AdminOrderLineItem[] {
  if (!Array.isArray(raw)) return []

  const items: AdminOrderLineItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const record = row as Record<string, unknown>
    const listingId =
      typeof record.listing_id === "string"
        ? record.listing_id
        : unwrapRelation(record.listings as { id?: string } | { id?: string }[] | null)?.id
    if (!listingId) continue

    const listing = unwrapRelation(
      record.listings as { title?: string | null } | { title?: string | null }[] | null,
    )
    items.push({
      listing_id: listingId,
      title: typeof listing?.title === "string" ? listing.title : null,
      sort_order: typeof record.sort_order === "number" ? record.sort_order : null,
    })
  }

  return items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

function parseAdminOrderShippingAddress(raw: unknown): AdminOrderShippingAddress {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  return raw as AdminOrderShippingAddress
}

export type AdminOrderStatusCounts = {
  total: number
  confirmed: number
  pending: number
  refunding: number
  refunded: number
}

const ORDER_STATUS_KEYS = ["confirmed", "pending", "refunding", "refunded"] as const

/**
 * Count orders per status using cheap `head: true` count queries (no row transfer).
 * Scales to large order tables without loading data.
 */
export async function dbGetAdminOrderStatusCounts(
  supabase: SupabaseClient,
): Promise<{ data: AdminOrderStatusCounts | null; error: PostgrestError | null }> {
  const totalRes = await supabase.from("orders").select("*", { count: "exact", head: true })
  if (totalRes.error) {
    return { data: null, error: totalRes.error }
  }

  const statusResults = await Promise.all(
    ORDER_STATUS_KEYS.map((status) =>
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", status),
    ),
  )

  const counts: AdminOrderStatusCounts = {
    total: totalRes.count ?? 0,
    confirmed: 0,
    pending: 0,
    refunding: 0,
    refunded: 0,
  }

  for (let i = 0; i < ORDER_STATUS_KEYS.length; i++) {
    const res = statusResults[i]
    if (res.error) {
      return { data: null, error: res.error }
    }
    counts[ORDER_STATUS_KEYS[i]] = res.count ?? 0
  }

  return { data: counts, error: null }
}

/** PostgREST rejects the whole row if the select lists a column missing from cache/DB (PGRST204). */
export function isPostgrestSchemaStaleError(err: Pick<PostgrestError, "code" | "message">): boolean {
  const msg = err.message ?? ""
  return (
    err.code === "PGRST204" ||
    msg.includes("shipping_amount") ||
    msg.includes("schema cache") ||
    msg.includes("Could not find the ") ||
    msg.includes("Could not find column") ||
    msg.includes("released_at") ||
    msg.includes("carrier_delivered_at")
  )
}

/**
 * Load a single order with listing title and buyer/seller profile labels (service role).
 */
export async function getOrderDetailForAdmin(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ data: AdminOrderDetail | null; error: PostgrestError | null }> {
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      status,
      amount,
      shipping_amount,
      platform_fee,
      seller_earnings,
      promo_discount_usd,
      payment_method,
      fulfillment_method,
      delivery_status,
      tracking_number,
      tracking_carrier,
      carrier_delivered_at,
      created_at,
      refunded_at,
      buyer_id,
      seller_id,
      listing_id,
      sales_channel,
      stripe_checkout_session_id,
      shipping_address,
      order_items (
        sort_order,
        listing_id,
        listings ( title )
      )
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr) {
    return { data: null, error: orderErr }
  }
  if (!order) {
    return { data: null, error: null }
  }

  const listingId = order.listing_id as string
  const buyerId = (order.buyer_id as string | null) ?? null
  const sellerId = order.seller_id as string
  const salesChannel =
    (order as { sales_channel?: string | null }).sales_channel ?? "online"
  const shippingAddress = parseAdminOrderShippingAddress(
    (order as { shipping_address?: unknown }).shipping_address,
  )
  const isTerminalGuestOrder = !buyerId

  const [listingRes, buyerRes, sellerRes, payoutRes, conversation] = await Promise.all([
    supabase.from("listings").select("title").eq("id", listingId).maybeSingle(),
    isTerminalGuestOrder
      ? Promise.resolve({ data: null, error: null })
      : supabase.from("profiles").select(ADMIN_ORDER_PARTICIPANT_SELECT).eq("id", buyerId).maybeSingle(),
    supabase.from("profiles").select(ADMIN_ORDER_PARTICIPANT_SELECT).eq("id", sellerId).maybeSingle(),
    supabase.from("payouts").select("status, hold_reason, released_at").eq("order_id", orderId).maybeSingle(),
    isTerminalGuestOrder
      ? Promise.resolve(null)
      : getConversationForBuyerSellerListing(supabase, buyerId, sellerId, listingId),
  ])

  const conversationId = conversation?.id ?? null
  let marketplaceMessageCount = 0
  if (conversationId) {
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
    marketplaceMessageCount = count ?? 0
  }

  const listingTitle =
    listingRes.data && typeof (listingRes.data as { title?: string }).title === "string"
      ? (listingRes.data as { title: string }).title
      : null

  const buyer = isTerminalGuestOrder
    ? mapGuestBuyerFromShippingAddress(shippingAddress)
    : mapAdminOrderParticipant(buyerId, (buyerRes.data as Record<string, unknown> | null) ?? null)
  const seller = mapAdminOrderParticipant(
    sellerId,
    (sellerRes.data as Record<string, unknown> | null) ?? null,
  )

  const amount = num(order.amount)
  const shippingAmount = num((order as { shipping_amount?: string | number | null }).shipping_amount)
  const promoDiscountUsd = num(
    (order as { promo_discount_usd?: string | number | null }).promo_discount_usd,
  )
  const itemPrice = Math.max(0, Math.round((amount - shippingAmount) * 100) / 100)
  const orderItems = parseAdminOrderLineItems((order as { order_items?: unknown }).order_items)

  const payoutRow = payoutRes.data as {
    status?: string
    hold_reason?: string | null
    released_at?: string | null
  } | null
  const payout =
    payoutRow && typeof payoutRow.status === "string"
      ? {
          status: payoutRow.status,
          hold_reason: payoutRow.hold_reason ?? null,
          released_at:
            typeof payoutRow.released_at === "string" && payoutRow.released_at
              ? payoutRow.released_at
              : null,
        }
      : null

  const ordMeta = order as {
    delivery_status?: string | null
    tracking_number?: string | null
    tracking_carrier?: string | null
    carrier_delivered_at?: string | null
  }

  return {
    data: {
      id: order.id as string,
      order_num: (order.order_num as string | null) ?? null,
      status: order.status as string,
      amount,
      item_price: itemPrice,
      shipping_amount: shippingAmount,
      platform_fee: num(order.platform_fee),
      seller_earnings: num(order.seller_earnings),
      promo_discount_usd: promoDiscountUsd,
      payment_method: order.payment_method as string,
      fulfillment_method: (order.fulfillment_method as string | null) ?? null,
      delivery_status: (ordMeta.delivery_status as string | null) ?? null,
      tracking_number: (ordMeta.tracking_number as string | null) ?? null,
      tracking_carrier: (ordMeta.tracking_carrier as string | null) ?? null,
      carrier_delivered_at:
        typeof ordMeta.carrier_delivered_at === "string" && ordMeta.carrier_delivered_at
          ? ordMeta.carrier_delivered_at
          : null,
      payout,
      created_at: order.created_at as string,
      refunded_at: (order.refunded_at as string | null) ?? null,
      buyer_id: buyerId,
      seller_id: sellerId,
      listing_id: listingId,
      listing_title: listingTitle,
      buyer,
      seller,
      shipping_address: shippingAddress,
      order_items: orderItems,
      conversation_id: conversationId,
      marketplace_message_count: marketplaceMessageCount,
      stripe_checkout_session_id: (order.stripe_checkout_session_id as string | null) ?? null,
      sales_channel: salesChannel,
    },
    error: null,
  }
}
