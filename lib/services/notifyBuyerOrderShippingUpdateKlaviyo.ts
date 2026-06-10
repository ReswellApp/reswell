import type { SupabaseClient } from "@supabase/supabase-js"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { trackKlaviyoOrderShippingUpdate } from "@/lib/klaviyo/track-order-shipping-update"
import {
  parseOrderTrackingDetail,
  type OrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { orderTrackingUpdateChanged } from "@/lib/shipping/order-tracking-update-key"

type OrderShippingUpdateRow = {
  buyer_id: string
  order_num: string | null
  fulfillment_method: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  listings: { title: string | null } | { title: string | null }[] | null
}

/**
 * Emits **Order Shipping Update** when carrier tracking advances beyond the previous snapshot.
 * Skips the first persisted snapshot (buyers already get **Order Shipped** with tracking info).
 */
export async function notifyBuyerOrderShippingUpdateKlaviyo(
  supabase: SupabaseClient,
  orderId: string,
  previousDetailRaw: unknown,
  newDetail: OrderTrackingDetail,
): Promise<void> {
  const previousDetail = parseOrderTrackingDetail(previousDetailRaw)
  if (!orderTrackingUpdateChanged(previousDetail, newDetail)) return

  const { data: row, error } = await supabase
    .from("orders")
    .select(
      "buyer_id, order_num, fulfillment_method, tracking_number, tracking_carrier, listings ( title )",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error || !row) {
    if (error) {
      console.error("[notifyBuyerOrderShippingUpdateKlaviyo] order load:", error.message)
    }
    return
  }

  const order = row as OrderShippingUpdateRow
  if (order.fulfillment_method !== "shipping") return

  const trackingNumber = order.tracking_number?.trim() ?? ""
  if (!trackingNumber) return

  const listingEmbed = order.listings
  const listingTitle = Array.isArray(listingEmbed)
    ? (listingEmbed[0]?.title ?? "")
    : (listingEmbed?.title ?? "")

  let buyerEmail: string | null = null
  try {
    buyerEmail = await getAuthEmailForUserId(order.buyer_id)
  } catch {
    /* non-critical */
  }

  await trackKlaviyoOrderShippingUpdate({
    buyerUserId: order.buyer_id,
    buyerEmail,
    orderId,
    orderNum: order.order_num,
    listingTitle: listingTitle || "Your order",
    trackingNumber,
    trackingCarrier: order.tracking_carrier,
    detail: newDetail,
  })
}
