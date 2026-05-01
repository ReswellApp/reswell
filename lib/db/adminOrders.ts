import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

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
  delivery_status: string | null
  tracking_number: string | null
  /** Matching payouts row when present — shipping uses held → pending manual release pipeline. */
  payout: { status: string; hold_reason: string | null; released_at: string | null } | null
}

function num(v: string | number | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
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
    msg.includes("released_at")
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
      "id, order_num, status, amount, shipping_amount, platform_fee, seller_earnings, payment_method, fulfillment_method, delivery_status, tracking_number, created_at, refunded_at, buyer_id, seller_id, listing_id, stripe_checkout_session_id",
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
  const buyerId = order.buyer_id as string
  const sellerId = order.seller_id as string

  const [listingRes, buyerRes, sellerRes, payoutRes] = await Promise.all([
    supabase.from("listings").select("title").eq("id", listingId).maybeSingle(),
    supabase.from("profiles").select("display_name, email").eq("id", buyerId).maybeSingle(),
    supabase.from("profiles").select("display_name, email").eq("id", sellerId).maybeSingle(),
    supabase.from("payouts").select("status, hold_reason, released_at").eq("order_id", orderId).maybeSingle(),
  ])

  const listingTitle =
    listingRes.data && typeof (listingRes.data as { title?: string }).title === "string"
      ? (listingRes.data as { title: string }).title
      : null

  const buyer = buyerRes.data as { display_name: string | null; email: string | null } | null
  const seller = sellerRes.data as { display_name: string | null; email: string | null } | null

  const amount = num(order.amount)
  const shippingAmount = num((order as { shipping_amount?: string | number | null }).shipping_amount)
  const itemPrice = Math.max(0, Math.round((amount - shippingAmount) * 100) / 100)

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
      payment_method: order.payment_method as string,
      fulfillment_method: (order.fulfillment_method as string | null) ?? null,
      delivery_status: (ordMeta.delivery_status as string | null) ?? null,
      tracking_number: (ordMeta.tracking_number as string | null) ?? null,
      payout,
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
