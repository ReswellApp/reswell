import {
  carrierTrackingDetailIsActionable,
  carrierTrackingIndicatesDelivered,
} from "@/lib/shipping/carrier-status-display"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"

/** Stable key for deduping carrier tracking emails (same scan → same key). */
export function orderTrackingUpdateKey(detail: OrderTrackingDetail): string {
  const latest = detail.events?.[0]
  return [
    detail.status_code ?? "",
    detail.status_description ?? "",
    detail.carrier_status_description ?? "",
    latest?.occurred_at ?? "",
    latest?.description ?? "",
    latest?.city_locality ?? "",
    latest?.state_province ?? "",
  ].join("|")
}

export function orderTrackingUpdateChanged(
  previous: OrderTrackingDetail | null | undefined,
  next: OrderTrackingDetail,
): boolean {
  if (!carrierTrackingDetailIsActionable(next)) return false
  if (!previous || !carrierTrackingDetailIsActionable(previous)) return false
  return orderTrackingUpdateKey(previous) !== orderTrackingUpdateKey(next)
}

/** True when the order or package was already marked delivered before this refresh. */
export function orderDeliveryAlreadyRecorded(input: {
  deliveryStatus?: string | null
  carrierDeliveredAt?: string | null
}): boolean {
  if ((input.deliveryStatus ?? "").trim() === "delivered") return true
  return Boolean(input.carrierDeliveredAt?.trim())
}

/**
 * Whether a carrier refresh should emit **Order Shipping Update**.
 * A page view of an already-delivered shipment can change the snapshot key
 * (status wording, timestamp format) without any new scan. That must not
 * email or text "delivered" again.
 */
export function shouldEmitOrderShippingUpdate(input: {
  previous: OrderTrackingDetail | null | undefined
  next: OrderTrackingDetail
  deliveryAlreadyRecorded?: boolean
}): boolean {
  if (!orderTrackingUpdateChanged(input.previous, input.next)) return false
  if (!carrierTrackingIndicatesDelivered(input.next)) return true
  if (carrierTrackingIndicatesDelivered(input.previous)) return false
  if (input.deliveryAlreadyRecorded) return false
  return true
}
