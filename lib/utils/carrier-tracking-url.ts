import { absoluteUrl } from "@/lib/site-metadata"
import { normalizeBrandedTrackingUrl } from "@/lib/utils/branded-tracking-url"

const ORDER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** First-party tracker on reswell.app. UUID is unguessable; page shows scans only. */
export function orderPackageTrackPath(orderId: string | null | undefined): string | null {
  const id = orderId?.trim() ?? ""
  if (!ORDER_ID_RE.test(id)) return null
  return `/track/${id}`
}

/**
 * In-app track href. Marketplace orders stay on Reswell (`/track/{orderId}`).
 * ShipEngine branded pages are only used when there is no order (staff labels).
 */
export function packageTrackHref(params: {
  orderId?: string | null
  brandedUrl?: string | null
  trackingNumber?: string | null
  trackingCarrier?: string | null
}): string | null {
  if (!params.trackingNumber?.trim()) return null
  const reswell = orderPackageTrackPath(params.orderId)
  if (reswell) return reswell
  return normalizeBrandedTrackingUrl(params.brandedUrl)
}

/**
 * Absolute track URL for email, SMS, and the mobile app.
 * Marketplace orders use `https://www.reswell.app/track/{orderId}`.
 */
export function preferredTrackingUrl(params: {
  orderId?: string | null
  brandedUrl?: string | null
  trackingNumber?: string | null
  trackingCarrier?: string | null
}): string | null {
  if (params.trackingNumber?.trim()) {
    const path = orderPackageTrackPath(params.orderId)
    if (path) return absoluteUrl(path)
  }
  return normalizeBrandedTrackingUrl(params.brandedUrl)
}

/**
 * Best-effort public tracking URLs from free-text carrier + tracking number.
 * Not used for Track your order — that always stays on Reswell.
 */
export function carrierTrackingUrl(
  trackingNumber: string,
  carrierHint: string | null | undefined,
): string | null {
  const tn = trackingNumber.trim()
  if (!tn) return null
  const h = (carrierHint ?? "").toLowerCase()

  if (h.includes("usps") || /\b(94|93|92|420)[0-9]{20,}\b/.test(tn.replace(/\s/g, ""))) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(tn)}`
  }
  if (h.includes("ups") || /^1Z/i.test(tn)) {
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(tn)}`
  }
  if (h.includes("fedex") || /\b([0-9]{12}|[0-9]{14}|[0-9]{15})\b/.test(tn.replace(/\s/g, ""))) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(tn)}`
  }
  if (h.includes("dhl")) {
    return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(tn)}`
  }

  return `https://www.google.com/search?q=${encodeURIComponent(`track package ${tn}`)}`
}
