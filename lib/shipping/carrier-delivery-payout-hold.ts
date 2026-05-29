import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { carrierTrackingIndicatesDelivered } from "@/lib/shipping/carrier-status-display"

/** Full calendar day hold after carrier-reported delivery before seller wallet credit. */
export const CARRIER_DELIVERY_PAYOUT_HOLD_MS = 24 * 60 * 60 * 1000

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

export function carrierDeliveryPayoutEligibleAt(carrierDeliveredAt: Date): Date {
  return new Date(carrierDeliveredAt.getTime() + CARRIER_DELIVERY_PAYOUT_HOLD_MS)
}

export function carrierDeliveryPayoutHoldElapsed(
  carrierDeliveredAt: Date | string | null | undefined,
  referenceTime: Date = new Date(),
): boolean {
  if (!carrierDeliveredAt) return false
  const at =
    carrierDeliveredAt instanceof Date
      ? carrierDeliveredAt
      : new Date(String(carrierDeliveredAt).trim())
  if (!Number.isFinite(at.getTime())) return false
  return referenceTime.getTime() >= carrierDeliveryPayoutEligibleAt(at).getTime()
}

export function msUntilCarrierPayoutRelease(
  carrierDeliveredAt: Date | string | null | undefined,
  referenceTime: Date = new Date(),
): number | null {
  if (!carrierDeliveredAt) return null
  const at =
    carrierDeliveredAt instanceof Date
      ? carrierDeliveredAt
      : new Date(String(carrierDeliveredAt).trim())
  if (!Number.isFinite(at.getTime())) return null
  return Math.max(0, carrierDeliveryPayoutEligibleAt(at).getTime() - referenceTime.getTime())
}

export function trackingDetailReportsDelivered(
  detail: OrderTrackingDetail | null | undefined,
): detail is OrderTrackingDetail {
  return carrierTrackingIndicatesDelivered(detail)
}
