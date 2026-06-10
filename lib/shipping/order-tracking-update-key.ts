import { carrierTrackingDetailIsActionable } from "@/lib/shipping/carrier-status-display"
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
