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
 * Branded page when we already have one. Otherwise the live redirect, which
 * creates the page on click. Carrier sites are only used when there is no order id.
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
  return preferredTrackingUrl({
    trackingNumber: params.trackingNumber,
    trackingCarrier: params.trackingCarrier,
  })
}

/**
 * Prefer the stored ShipEngine branded page. Otherwise the carrier's public tracker.
 */
export function preferredTrackingUrl(params: {
  brandedUrl?: string | null
  trackingNumber?: string | null
  trackingCarrier?: string | null
}): string | null {
  const branded = normalizeBrandedTrackingUrl(params.brandedUrl)
  if (branded) return branded
  const trackingNumber = params.trackingNumber?.trim()
  if (!trackingNumber) return null
  return carrierTrackingUrl(trackingNumber, params.trackingCarrier)
}

/**
 * Best-effort public tracking URLs from free-text carrier + tracking number.
 * Does not guarantee the carrier matches; sellers should enter carrier names consistently.
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
