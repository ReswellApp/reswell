/**
 * Server-only: Klaviyo Events API — seller-side counterpart to buyer **Order Shipped**.
 *
 * **Metric name in Klaviyo:** `Seller Order Shipped` — profile is the **seller**.
 *
 * Use this as the exit / “has shipped” trigger on seller fulfillment flows that start from
 * **Shipping Sale Received**. Do not reuse buyer **Order Shipped** on the seller profile —
 * that metric drives buyer “your order shipped” email/SMS.
 *
 * Template variables: `{{ event.order_num }}`, `{{ event.Title }}`, `{{ event.sale_url }}`,
 * `{{ event.tracking_number }}`, `{{ event.tracking_carrier }}`.
 */

import { sellerSaleUrl } from "@/lib/klaviyo/seller-sale-event-helpers"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"

export type KlaviyoSellerOrderShippedPayload = {
  sellerUserId: string
  sellerEmail: string | null
  orderId: string
  orderNum?: string | null
  listingTitle: string
  trackingNumber: string
  trackingCarrier: string | null
}

export async function trackKlaviyoSellerOrderShipped(
  payload: KlaviyoSellerOrderShippedPayload,
): Promise<void> {
  const trackingNumber = payload.trackingNumber.trim()
  if (!trackingNumber) return

  await sendKlaviyoServerEvent({
    metricName: "Seller Order Shipped",
    profile: {
      external_id: payload.sellerUserId,
      email: payload.sellerEmail,
    },
    uniqueId: `seller-order-shipped-${payload.orderId}`,
    properties: {
      order_id: payload.orderId,
      order_num: formatOrderNumForCustomer(payload.orderNum, payload.orderId),
      Title: payload.listingTitle,
      sale_url: sellerSaleUrl(payload.orderId),
      tracking_number: trackingNumber,
      tracking_carrier: payload.trackingCarrier?.trim() ?? "",
    },
  })
}
