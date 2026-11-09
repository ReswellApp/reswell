import type { SupabaseClient } from "@supabase/supabase-js"
import { purchaseHrefForOrderId, saleHrefForOrderId } from "@/lib/earnings-sale-ledger"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import {
  orderDeliveredBuyerBody,
  orderDeliveredBuyerTitle,
  orderDeliveredDedupeKey,
  orderDeliveredPayoutDedupeKey,
  orderDeliveredSellerPayoutAvailableBody,
  orderDeliveredSellerPayoutSoonBody,
  orderDeliveredSellerTitle,
  orderPickedUpBuyerBody,
  orderPickedUpBuyerTitle,
  orderPickedUpSellerBody,
  orderPickedUpSellerTitle,
} from "@/lib/services/notifications/catalog"
import { publishInAppNotifications } from "@/lib/services/notifications/publish"
import type { InAppNotificationInput } from "@/lib/services/notifications/plan"
import { createServiceRoleClient } from "@/lib/supabase/server"

export type OrderDeliveredNotice = {
  orderId: string
  /** Carrier delivery starts the payout hold. Pickup and payout release pay out now. */
  buyerEvent: "delivered" | "picked_up"
  sellerPayout: "soon" | "available"
}

const CLOSED_ORDER_STATUSES = new Set(["refunded", "refunding", "cancelled", "canceled", "failed"])

/**
 * One buyer row and one seller row per order. A later call with different copy
 * does not replace the first — delivery is recorded once.
 */
export async function publishOrderDeliveredNotifications(
  input: OrderDeliveredNotice,
): Promise<void> {
  const orderId = input.orderId.trim()
  if (!orderId) return

  let supabase: SupabaseClient
  try {
    supabase = createServiceRoleClient()
  } catch (error) {
    console.error(
      "[notifications] order delivered service role:",
      error instanceof Error ? error.message : error,
    )
    return
  }

  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_num, buyer_id, seller_id, listing_id, status, is_admin_test")
      .eq("id", orderId)
      .maybeSingle()

    if (error || !data) {
      if (error) console.error("[notifications] order delivered load:", error.message)
      return
    }

    const order = data as {
      id: string
      order_num: string | null
      buyer_id: string | null
      seller_id: string | null
      listing_id: string | null
      status: string | null
      is_admin_test: boolean | null
    }

    if (order.is_admin_test === true) return
    const status = (order.status ?? "").trim().toLowerCase()
    if (CLOSED_ORDER_STATUSES.has(status)) return

    const orderNum = formatOrderNumForCustomer(order.order_num, order.id)
    const listingId = order.listing_id?.trim() || null
    const inputs: InAppNotificationInput[] = []

    const buyerId = order.buyer_id?.trim() || ""
    if (buyerId) {
      const pickedUp = input.buyerEvent === "picked_up"
      inputs.push({
        userId: buyerId,
        type: "order_delivered",
        listingId,
        title: pickedUp ? orderPickedUpBuyerTitle() : orderDeliveredBuyerTitle(),
        body: pickedUp ? orderPickedUpBuyerBody(orderNum) : orderDeliveredBuyerBody(orderNum),
        href: purchaseHrefForOrderId(order.id),
        dedupeKey: orderDeliveredDedupeKey(order.id),
        metadata: { orderId: order.id, orderNum, event: input.buyerEvent },
      })
    }

    const sellerId = order.seller_id?.trim() || ""
    if (sellerId && sellerId !== buyerId) {
      const pickedUp = input.buyerEvent === "picked_up"
      const payoutSoon = !pickedUp && input.sellerPayout === "soon"
      inputs.push({
        userId: sellerId,
        type: "order_delivered_payout",
        listingId,
        title: pickedUp ? orderPickedUpSellerTitle() : orderDeliveredSellerTitle(),
        body: pickedUp
          ? orderPickedUpSellerBody(orderNum)
          : payoutSoon
            ? orderDeliveredSellerPayoutSoonBody(orderNum)
            : orderDeliveredSellerPayoutAvailableBody(orderNum),
        href: saleHrefForOrderId(order.id),
        dedupeKey: orderDeliveredPayoutDedupeKey(order.id),
        metadata: {
          orderId: order.id,
          orderNum,
          sellerPayout: pickedUp ? "available" : input.sellerPayout,
        },
      })
    }

    if (inputs.length === 0) return
    await publishInAppNotifications(supabase, inputs)
  } catch (error) {
    console.error(
      "[notifications] order delivered:",
      error instanceof Error ? error.message : error,
    )
  }
}
