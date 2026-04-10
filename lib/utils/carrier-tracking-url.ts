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
