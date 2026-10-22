/**
 * Server-only: Klaviyo Events API — fires for a buyer-relevant carrier milestone.
 *
 * **Metric name in Klaviyo:** `Order Shipping Update` — create a flow triggered by this metric.
 * Distinct from **Order Shipped** (fires once when the order is marked shipped or the first
 * in-transit carrier scan lands). This metric is limited to out for delivery, a delivery
 * attempt, available for pickup, an exception, and delivered. Facility hops do not emit
 * an event, so email and SMS flows cannot send for them.
 *
 * Template variables: `{{ event.order_num }}`, `{{ event.Title }}`, `{{ event.status_label }}`,
 * `{{ event.latest_event_description }}`, `{{ event.latest_event_location }}`,
 * `{{ event.tracking_number }}`, `{{ event.tracking_carrier }}`, `{{ event.tracking_url }}`,
 * `{{ event.estimated_delivery_date }}`,
 * `{{ event.is_delivered }}`, `{{ event.order_url }}`, `{{ event.sms_milestone }}`,
 * `{{ event.notification_kind }}`, `{{ event.has_sms_phone }}`.
 * Buyer email HTML: `KLAVIYO_ORDER_SHIPPING_UPDATE_EMAIL_HTML` in
 * `order-shipping-update-email-liquid.ts`.
 *
 * Profile on the event is the **buyer**. When a phone is on file it is attached as `phone_number`
 * so Klaviyo SMS actions can send.
 *
 * **Klaviyo SMS flow (manual):** trigger on this metric with an SMS action filtered to
 * `sms_milestone` is one of `out_for_delivery`, `delivered`, `exception`. Every event this
 * app emits sets one of those. Delivery attempts and pickup holds use `exception`.
 * `notification_kind` is the finer reason when a flow needs to split copy.
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
import type {
  OrderShippingSmsMilestone,
  ShippingNotificationKind,
} from "@/lib/shipping/order-shipping-sms-milestone"

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
  trackingUrl?: string | null
  detail: OrderTrackingDetail
  /** Always set. Attempts and pickup holds use `exception`. */
  smsMilestone: OrderShippingSmsMilestone
  notificationKind: ShippingNotificationKind
  /** Stable per milestone so a repeat scan does not re-trigger the Klaviyo flow. */
  dedupeKey: string
}

/** Klaviyo `unique_id` for one buyer shipping milestone on an order. */
export function orderShippingUpdateEventId(orderId: string, dedupeKey: string): string {
  const dedupe = dedupeKey
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
  return `order-shipping-update-${orderId}-${dedupe || "milestone"}`
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
  const phone = payload.buyerPhoneE164?.trim() || null

  await sendKlaviyoServerEvent({
    metricName: "Order Shipping Update",
    profile: {
      external_id: payload.buyerUserId,
      email: payload.buyerEmail,
      phone_number: phone,
    },
    uniqueId: orderShippingUpdateEventId(payload.orderId, payload.dedupeKey),
    properties: {
      order_id: payload.orderId,
      order_num: formatOrderNumForCustomer(payload.orderNum, payload.orderId),
      Title: payload.listingTitle,
      tracking_number: payload.trackingNumber,
      tracking_carrier: payload.trackingCarrier ?? "",
      tracking_url: payload.trackingUrl?.trim() || orderUrl,
      status_code: detail.status_code ?? "",
      status_label: resolveCarrierStatusHeadline(detail),
      latest_event_description: latestEvent?.description?.trim() ?? "",
      latest_event_location: latestEventLocation(detail),
      estimated_delivery_date: detail.estimated_delivery_date ?? "",
      is_delivered: carrierTrackingIndicatesDelivered(detail),
      order_url: orderUrl,
      sms_milestone: payload.smsMilestone,
      notification_kind: payload.notificationKind,
      has_sms_phone: Boolean(phone),
    },
  })
}
