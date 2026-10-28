import { normalizeBrandedTrackingUrl } from "@/lib/utils/branded-tracking-url"

const ORDER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Live track redirect. Resolves the branded page at click time so older
 * purchase and sale messages are not stuck on a carrier URL saved in the thread.
 */
export function orderPackageTrackPath(orderId: string | null | undefined): string | null {
  const id = orderId?.trim() ?? ""
  if (!ORDER_ID_RE.test(id)) return null
  return `/api/orders/${id}/track`
}

/**
 * Branded ShipEngine page when we already have one. Otherwise the live redirect,
 * which creates the page on click. Never sends buyers to UPS/USPS/FedEx.
 */
export function packageTrackHref(params: {
  orderId?: string | null
  brandedUrl?: string | null
  trackingNumber?: string | null
  trackingCarrier?: string | null
}): string | null {
  const branded = normalizeBrandedTrackingUrl(params.brandedUrl)
  if (branded) return branded
  const live = orderPackageTrackPath(params.orderId)
  if (live && params.trackingNumber?.trim()) return live
  return null
}

/**
 * ShipEngine branded page only. Carrier websites are not used for Track your order.
 */
export function preferredTrackingUrl(params: {
  brandedUrl?: string | null
  trackingNumber?: string | null
  trackingCarrier?: string | null
}): string | null {
  return normalizeBrandedTrackingUrl(params.brandedUrl)
}

/**
 * Best-effort public tracking URLs from free-text carrier + tracking number.
 * Not used for Track your order — that always goes through ShipEngine.
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
