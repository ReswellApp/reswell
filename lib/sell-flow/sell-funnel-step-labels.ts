/** Human label for a sell form section DOM id stored in funnel `field`. */
export function sellFunnelStepLabel(stepId: string): string {
  const trimmed = stepId.trim()
  if (!trimmed) return "(unknown step)"

  const known: Record<string, string> = {
    "sell-section-product": "Product Info",
    "sell-section-basics": "Product Info",
    "sell-section-photos": "Photos & Description",
    "sell-section-details": "Product Info",
    "sell-section-photos-title": "Photos & title",
    "sell-section-board": "Board & description",
    "sell-section-shipping": "Shipping",
    "sell-section-delivery": "Shipping",
    "sell-section-reswell-package": "Shipping size",
    "sell-section-pricing": "Pricing",
    "sell-section-publish": "Pricing",
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
