import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { carrierTrackingIndicatesDelivered } from "@/lib/shipping/carrier-status-display"

export {
  CARRIER_DELIVERY_PAYOUT_HOLD_DAYS,
  CARRIER_DELIVERY_PAYOUT_HOLD_MS,
  carrierDeliveryPayoutEligibleAt,
  carrierDeliveryPayoutHoldElapsed,
  msUntilCarrierPayoutRelease,
} from "@/lib/shipping/carrier-delivery-payout-timing"

const IN_TRANSIT_STATUS_CODES = new Set(["IT", "AC", "AT", "OF"])

export function carrierTrackingIndicatesInTransit(
  detail: OrderTrackingDetail | null | undefined,
): boolean {
  if (!detail) return false
  const code = (detail.status_code ?? "").toUpperCase()
  return IN_TRANSIT_STATUS_CODES.has(code)
}

/** Prefer ShipEngine actual_delivery_date; fall back to newest event or snapshot time. */
export function resolveCarrierDeliveredAt(
  detail: OrderTrackingDetail,
  observedAt: Date = new Date(),
): Date {
  const actual = detail.actual_delivery_date?.trim()
  if (actual) {
    const parsed = Date.parse(actual)
    if (Number.isFinite(parsed)) return new Date(parsed)
  }

  const events = detail.events ?? []
  for (const event of events) {
    const at = event.occurred_at?.trim()
    if (!at) continue
    const parsed = Date.parse(at)
    if (Number.isFinite(parsed)) return new Date(parsed)
  }

  const updated = detail.updated_at?.trim()
  if (updated) {
    const parsed = Date.parse(updated)
    if (Number.isFinite(parsed)) return new Date(parsed)
  }

  return observedAt
}

export function trackingDetailReportsDelivered(
  detail: OrderTrackingDetail | null | undefined,
): detail is OrderTrackingDetail {
  return carrierTrackingIndicatesDelivered(detail)
}
