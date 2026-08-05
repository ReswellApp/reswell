/** Human label for a sell form section DOM id stored in funnel `field`. */
export function sellFunnelStepLabel(stepId: string): string {
  const trimmed = stepId.trim()
  if (!trimmed) return "(unknown step)"

  const known: Record<string, string> = {
    "sell-section-basics": "Brand, model & title",
    "sell-section-details": "Dimensions & details",
    "sell-section-photos-title": "Photos & title",
    "sell-section-board": "Board & description",
    "sell-section-delivery": "Pickup & shipping",
    "sell-section-reswell-package": "Shipping size",
    "sell-section-publish": "Photos & publish",
    "sell-fins-section-photos-title": "Photos & title",
    "sell-fins-section-details": "Fin details",
    "sell-fins-section-delivery": "Shipping",
    "sell-fins-section-publish": "Price & publish",
  }

  if (known[trimmed]) return known[trimmed]

  const peerMatch = /^sell-([a-z]+)-section-(.+)$/.exec(trimmed)
  if (peerMatch) {
    const [, product, section] = peerMatch
    const sectionLabel =
      section === "photos-title"
        ? "Photos & title"
        : section === "details"
          ? "Details"
          : section === "delivery"
            ? "Pickup & shipping"
            : section === "publish"
              ? "Price & publish"
              : section.replace(/-/g, " ")
    const productLabel = product.charAt(0).toUpperCase() + product.slice(1)
    return `${productLabel} · ${sectionLabel}`
  }

  return trimmed.replace(/^sell-/, "").replace(/-/g, " ")
}
