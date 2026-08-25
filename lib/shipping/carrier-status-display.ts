import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"

export function trackingStatusLabel(detail: OrderTrackingDetail): string {
  return (
    detail.status_description?.trim() ||
    detail.carrier_status_description?.trim() ||
    "Tracking update"
  )
}

export function latestCarrierEventDescription(
  detail: OrderTrackingDetail | null | undefined,
): string | null {
  const events = detail?.events
  if (!events?.length) return null
  for (const event of events) {
    const text = event.description?.trim()
    if (text) return text
  }
  return null
}

/** Prefer the newest scan event; fall back to carrier status headline. */
export function resolveCarrierStatusHeadline(detail: OrderTrackingDetail): string {
  const latestEvent = latestCarrierEventDescription(detail)
  if (latestEvent) return latestEvent

  return trackingStatusLabel(detail)
}

/** True when ShipEngine tracking has enough data to drive marketplace status UI. */
export function carrierTrackingDetailIsActionable(
  detail: OrderTrackingDetail | null | undefined,
): detail is OrderTrackingDetail {
  if (!detail) return false
  if (detail.status_code?.trim()) return true
  if (detail.status_description?.trim()) return true
  if (detail.carrier_status_description?.trim()) return true
  return Boolean(detail.events?.some((event) => event.description?.trim()))
}

/** ShipEngine `DE` or an actual delivery timestamp means the shipment is complete. */
export function carrierTrackingIndicatesDelivered(
  detail: OrderTrackingDetail | null | undefined,
): boolean {
  if (!carrierTrackingDetailIsActionable(detail)) return false
  const code = (detail.status_code ?? "").toUpperCase()
  if (code === "DE") return true
  return Boolean(detail.actual_delivery_date?.trim())
}

/** First physical scan or later (accepted, in transit, exception, delivered). */
const CARRIER_SCANNED_STATUS_CODES = new Set(["AC", "IT", "AT", "OF", "DE", "EX"])

/**
 * True once the carrier has the package. Label-created / unknown / not-yet-in-system
 * (`UN`, `NY`, empty) stay false so drop-off tiles can remain visible.
 */
export function carrierTrackingIndicatesScanned(
  detail: OrderTrackingDetail | null | undefined,
): boolean {
  if (!detail) return false
  if (detail.actual_delivery_date?.trim()) return true
  const code = (detail.status_code ?? "").trim().toUpperCase()
  return CARRIER_SCANNED_STATUS_CODES.has(code)
}

export function trackingStatusTone(
  statusCode: string | null | undefined,
): "default" | "success" | "warning" | "muted" {
  const code = (statusCode ?? "").toUpperCase()
  if (code === "DE") return "success"
  if (code === "EX") return "warning"
  if (code === "IT" || code === "AC" || code === "AT") return "default"
  return "muted"
}
