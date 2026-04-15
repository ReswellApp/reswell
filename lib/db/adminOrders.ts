import type { SupabaseClient } from "@supabase/supabase-js"

export type AdminOrderDetail = {
  id: string
  order_num: string | null
  status: string
  amount: number
  platform_fee: number
  seller_earnings: number
  payment_method: string
  fulfillment_method: string | null
  created_at: string
  refunded_at: string | null
  buyer_id: string
  seller_id: string
  listing_id: string
  listing_title: string | null
  buyer_display_name: string | null
  buyer_email: string | null
  seller_display_name: string | null
  seller_email: string | null
  stripe_checkout_session_id: string | null
}

function num(v: string | number | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Load a single order with listing title and buyer/seller profile labels (service role).
 */
export async function getOrderDetailForAdmin(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ data: AdminOrderDetail | null; error: Error | null }> {
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      "id, order_num, status, amount, platform_fee, seller_earnings, payment_method, fulfillment_method, created_at, refunded_at, buyer_id, seller_id, listing_id, stripe_checkout_session_id",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr) {
    return { data: null, error: new Error(orderErr.message) }
  }
  if (!order) {
    return { data: null, error: null }
  }

  const listingId = order.listing_id as string
  const buyerId = order.buyer_id as string
  const sellerId = order.seller_id as string

  const [listingRes, buyerRes, sellerRes] = await Promise.all([
    supabase.from("listings").select("title").eq("id", listingId).maybeSingle(),
    supabase.from("profiles").select("display_name, email").eq("id", buyerId).maybeSingle(),
    supabase.from("profiles").select("display_name, email").eq("id", sellerId).maybeSingle(),
  ])

  const listingTitle =
    listingRes.data && typeof (listingRes.data as { title?: string }).title === "string"
      ? (listingRes.data as { title: string }).title
      : null

  const buyer = buyerRes.data as { display_name: string | null; email: string | null } | null
  const seller = sellerRes.data as { display_name: string | null; email: string | null } | null

  return {
    data: {
      id: order.id as string,
      order_num: (order.order_num as string | null) ?? null,
      status: order.status as string,
      amount: num(order.amount),
      platform_fee: num(order.platform_fee),
      seller_earnings: num(order.seller_earnings),
      payment_method: order.payment_method as string,
      fulfillment_method: (order.fulfillment_method as string | null) ?? null,
      created_at: order.created_at as string,
      refunded_at: (order.refunded_at as string | null) ?? null,
      buyer_id: buyerId,
      seller_id: sellerId,
      listing_id: listingId,
      listing_title: listingTitle,
      buyer_display_name: buyer?.display_name ?? null,
      buyer_email: buyer?.email ?? null,
      seller_display_name: seller?.display_name ?? null,
      seller_email: seller?.email ?? null,
      stripe_checkout_session_id: (order.stripe_checkout_session_id as string | null) ?? null,
    },
    error: null,
  }
}
