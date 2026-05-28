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

export function trackingStatusTone(
  statusCode: string | null | undefined,
): "default" | "success" | "warning" | "muted" {
  const code = (statusCode ?? "").toUpperCase()
  if (code === "DE") return "success"
  if (code === "EX") return "warning"
  if (code === "IT" || code === "AC" || code === "AT") return "default"
  return "muted"
}
