/**
 * Server-only: Klaviyo Events API — fires when ShipEngine reports a new carrier scan on a shipped order.
 *
 * **Metric name in Klaviyo:** `Order Shipping Update` — create a flow triggered by this metric.
 * Distinct from **Order Shipped** (fires once when the seller adds tracking). Use this metric for
 * in-transit, out-for-delivery, delivered, and exception emails from real carrier data.
 *
 * Template variables: `{{ event.order_num }}`, `{{ event.Title }}`, `{{ event.status_label }}`,
 * `{{ event.latest_event_description }}`, `{{ event.latest_event_location }}`,
 * `{{ event.tracking_number }}`, `{{ event.tracking_carrier }}`, `{{ event.estimated_delivery_date }}`,
 * `{{ event.is_delivered }}`, `{{ event.order_url }}`.
 *
 * Profile on the event is the **buyer**.
 */

import { carrierTrackingIndicatesDelivered, resolveCarrierStatusHeadline } from "@/lib/shipping/carrier-status-display"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { orderTrackingUpdateKey } from "@/lib/shipping/order-tracking-update-key"

export type KlaviyoOrderShippingUpdatePayload = {
  buyerUserId: string
  buyerEmail: string | null
  orderId: string
  orderNum?: string | null
  listingTitle: string
  trackingNumber: string
  trackingCarrier: string | null
  detail: OrderTrackingDetail
}

function latestEventLocation(detail: OrderTrackingDetail): string {
  const event = detail.events?.[0]
  if (!event) return ""
  const parts = [event.city_locality?.trim(), event.state_province?.trim()].filter(Boolean)
  return parts.join(", ")
}

export async function trackKlaviyoOrderShippingUpdate(
  payload: KlaviyoOrderShippingUpdatePayload,
): Promise<void> {
  const origin = publicSiteOrigin()
  const orderUrl = `${origin}/dashboard/purchases/${payload.orderId}`
  const detail = payload.detail
  const latestEvent = detail.events?.[0]
  const updateKey = orderTrackingUpdateKey(detail)

  await sendKlaviyoServerEvent({
    metricName: "Order Shipping Update",
    profile: {
      external_id: payload.buyerUserId,
      email: payload.buyerEmail,
    },
    uniqueId: `order-shipping-update-${payload.orderId}-${updateKey.replace(/\|/g, "-").slice(0, 180)}`,
    properties: {
      order_id: payload.orderId,
      order_num: formatOrderNumForCustomer(payload.orderNum, payload.orderId),
      Title: payload.listingTitle,
      tracking_number: payload.trackingNumber,
      tracking_carrier: payload.trackingCarrier ?? "",
      status_code: detail.status_code ?? "",
      status_label: resolveCarrierStatusHeadline(detail),
      latest_event_description: latestEvent?.description?.trim() ?? "",
      latest_event_location: latestEventLocation(detail),
      estimated_delivery_date: detail.estimated_delivery_date ?? "",
      is_delivered: carrierTrackingIndicatesDelivered(detail),
      order_url: orderUrl,
    },
  })
}
