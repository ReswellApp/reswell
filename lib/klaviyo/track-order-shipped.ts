/**
 * Server-only: Klaviyo Events API — fires when the seller adds tracking to a shipped purchase.
 *
 * **Metric name in Klaviyo:** `Order Shipped` — create a flow triggered by this metric (fires once
 * when tracking is added). For ongoing carrier scan updates, use **Order Shipping Update** instead.
 * Template variables: `{{ event.Title }}`, `{{ event.tracking_number }}`,
 * `{{ event.tracking_carrier }}`, `{{ event.order_url }}`.
 *
 * Profile on the event is the **buyer**.
 */

import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type KlaviyoOrderShippedPayload = {
  buyerUserId: string
  buyerEmail: string | null
  orderId: string
  listingTitle: string
  trackingNumber: string
  trackingCarrier: string | null
}

export async function trackKlaviyoOrderShipped(
  payload: KlaviyoOrderShippedPayload,
): Promise<void> {
  const origin = publicSiteOrigin()
  const orderUrl = `${origin}/dashboard/purchases/${payload.orderId}`

  await sendKlaviyoServerEvent({
    metricName: "Order Shipped",
    profile: {
      external_id: payload.buyerUserId,
      email: payload.buyerEmail,
    },
    uniqueId: `order-shipped-${payload.orderId}`,
    properties: {
      order_id: payload.orderId,
      Title: payload.listingTitle,
      tracking_number: payload.trackingNumber,
      tracking_carrier: payload.trackingCarrier ?? "",
      order_url: orderUrl,
    },
  })
}
