export type ListingFulfillmentPdpCopy = {
  headline: string
  subline: string | null
}

function shippingDetailPhrase(
  shippingLine: string | null | undefined,
  shippingCostMode: "reswell" | "flat" | "free" | null | undefined,
  shippingFlatRate: number,
): string | null {
  const trimmed = shippingLine?.trim()
  if (trimmed) return trimmed
  if (shippingCostMode === "free") return "Free shipping at checkout"
  if (shippingCostMode === "flat" && shippingFlatRate > 0) {
    return `Flat $${shippingFlatRate.toFixed(2)} shipping at checkout`
  }
  return "Shipping calculated at checkout"
}

/** One headline + subline for listing PDP fulfillment (mobile app + mobile web). */
export function listingFulfillmentPdpCopy(input: {
  pickupOffered: boolean
  shippingOffered: boolean
  locationLine?: string | null
  /** Buyer-facing shipping line when the API already resolved copy. */
  shippingLine?: string | null
  shippingCostMode?: "reswell" | "flat" | "free" | null
  shippingFlatRate?: number
  isSold?: boolean
  soldShipped?: boolean
}): ListingFulfillmentPdpCopy | null {
  if (input.isSold) {
    if (input.soldShipped) return { headline: "This item was shipped", subline: null }
    return null
  }

  const pickup = input.pickupOffered
  const shipping = input.shippingOffered
  if (!pickup && !shipping) return null

  let headline: string
  if (shipping && pickup) headline = "Shipping and local pickup available"
  else if (shipping) headline = "Shipping available"
  else headline = "Local pickup available"

  const parts: string[] = []
  const location = input.locationLine?.trim()
  if (location) parts.push(location)

  if (shipping) {
    const ship = shippingDetailPhrase(input.shippingLine, input.shippingCostMode, input.shippingFlatRate ?? 0)
    if (ship) parts.push(ship)
  }

  return { headline, subline: parts.length > 0 ? parts.join(" · ") : null }
}
