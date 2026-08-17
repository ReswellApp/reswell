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
 * `{{ event.is_delivered }}`, `{{ event.order_url }}`, `{{ event.sms_milestone }}`,
 * `{{ event.has_sms_phone }}`.
 *
 * Profile on the event is the **buyer**. When a phone is on file it is attached as `phone_number`
 * so Klaviyo SMS actions can send.
 *
 * **Klaviyo SMS flow (manual):** trigger on this metric with an SMS action filtered to
 * `sms_milestone` is one of `out_for_delivery`, `delivered`, `exception`. Do **not** SMS when
 * `sms_milestone` is empty (email can still send on every actionable scan).
 * Suggested SMS: `Reswell: {{ event.status_label }} — {{ event.Title }}. {{ event.order_url }}`
 * Requires profile phone + SMS transactional consent in Klaviyo.
 *
 * Bootstrap (surface `sms_milestone` in filters):  
 * `POST /api/integrations/klaviyo/bootstrap-order-shipping-update-metric`  
 * (Bearer `CRON_SECRET` when set).
 */

import { carrierTrackingIndicatesDelivered, resolveCarrierStatusHeadline } from "@/lib/shipping/carrier-status-display"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import type { OrderShippingSmsMilestone } from "@/lib/shipping/order-shipping-sms-milestone"
import { orderTrackingUpdateKey } from "@/lib/shipping/order-tracking-update-key"

export type KlaviyoOrderShippingUpdatePayload = {
  buyerUserId: string
  buyerEmail: string | null
  /** E.164 when the buyer has a phone on file */
  buyerPhoneE164?: string | null
  orderId: string
  orderNum?: string | null
  listingTitle: string
  trackingNumber: string
  trackingCarrier: string | null
  detail: OrderTrackingDetail
  /** Set only on first transition into OFD / delivered / exception */
  smsMilestone?: OrderShippingSmsMilestone | null
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
  const phone = payload.buyerPhoneE164?.trim() || null
  const smsMilestone = payload.smsMilestone ?? null

  await sendKlaviyoServerEvent({
    metricName: "Order Shipping Update",
    profile: {
      external_id: payload.buyerUserId,
      email: payload.buyerEmail,
      phone_number: phone,
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
      sms_milestone: smsMilestone ?? "",
      has_sms_phone: Boolean(phone),
    },
  })
}
