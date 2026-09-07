/**
 * Server-only: Klaviyo Events API — fires when the seller adds tracking to a shipped purchase.
 *
 * **Metric name in Klaviyo:** `Order Shipped` — create a flow triggered by this metric (fires once
 * when the order is marked shipped or the first in-transit carrier scan lands). For ongoing
 * carrier scan updates, use **Order Shipping Update** instead. Seller fulfillment flows should
 * exit on **Seller Order Shipped**, not this buyer metric.
 * Template variables: `{{ event.Title }}`, `{{ event.tracking_number }}`,
 * `{{ event.tracking_carrier }}`, `{{ event.order_url }}`, `{{ event.sms_milestone }}`,
 * `{{ event.has_sms_phone }}`.
 *
 * Profile on the event is the **buyer**. When a phone is on file it is attached as `phone_number`
 * so Klaviyo SMS actions can send.
 *
 * **Klaviyo SMS flow (manual):** live flow on this metric with a transactional SMS action.
 * Profile must have phone + SMS transactional consent in Klaviyo.
 * Suggested SMS: `Reswell: {{ event.Title }} shipped. Track: {{ event.tracking_number }}`
 * `sms_milestone` is always `shipped` on this metric.
 */

import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type KlaviyoOrderShippedPayload = {
  buyerUserId: string
  buyerEmail: string | null
  /** E.164 when the buyer has a phone on file */
  buyerPhoneE164?: string | null
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
  const phone = payload.buyerPhoneE164?.trim() || null

  await sendKlaviyoServerEvent({
    metricName: "Order Shipped",
    profile: {
      external_id: payload.buyerUserId,
      email: payload.buyerEmail,
      phone_number: phone,
    },
    uniqueId: `order-shipped-${payload.orderId}`,
    properties: {
      order_id: payload.orderId,
      Title: payload.listingTitle,
      tracking_number: payload.trackingNumber,
      tracking_carrier: payload.trackingCarrier ?? "",
      order_url: orderUrl,
      sms_milestone: "shipped",
      has_sms_phone: Boolean(phone),
    },
  })
}
