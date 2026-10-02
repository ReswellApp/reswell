/** How a surfboard (or shippable listing) can be fulfilled — maps to DB booleans. */

export type BoardFulfillmentChoice = "pickup_only" | "shipping_only" | "pickup_and_shipping"

export function boardFulfillmentFromFlags(
  localPickup: boolean | null | undefined,
  shippingAvailable: boolean | null | undefined
): BoardFulfillmentChoice {
  const lp = localPickup !== false
  const sa = !!shippingAvailable
  if (lp && sa) return "pickup_and_shipping"
  if (sa && !lp) return "shipping_only"
  return "pickup_only"
}

export function flagsFromBoardFulfillment(
  mode: BoardFulfillmentChoice
): { local_pickup: boolean; shipping_available: boolean } {
  switch (mode) {
    case "pickup_only":
      return { local_pickup: true, shipping_available: false }
    case "shipping_only":
      return { local_pickup: false, shipping_available: true }
    case "pickup_and_shipping":
      return { local_pickup: true, shipping_available: true }
    default:
      // Corrupt drafts / legacy snapshots may not match the union at runtime.
      return { local_pickup: true, shipping_available: false }
  }
}

/** Maps independent delivery toggles to the stored fulfillment mode. */
export function boardFulfillmentFromChecks(
  shippingAvailable: boolean,
  localPickup: boolean
): BoardFulfillmentChoice {
  if (shippingAvailable && localPickup) return "pickup_and_shipping"
  if (shippingAvailable) return "shipping_only"
  return "pickup_only"
}

export function boardFulfillmentSummary(
  localPickup: boolean | null | undefined,
  shippingAvailable: boolean | null | undefined
): string {
  const mode = boardFulfillmentFromFlags(localPickup, shippingAvailable)
  switch (mode) {
    case "pickup_only":
      return "Local pickup"
    case "shipping_only":
      return "Shipping"
    case "pickup_and_shipping":
      return "Pickup or shipping"
  }
}

/** Accordion heading on listing pages — names only the options this listing actually offers. */
export function boardFulfillmentSectionTitle(
  pickupOffered: boolean,
  shippingOffered: boolean,
): string {
  if (pickupOffered && shippingOffered) return "Shipping or pickup"
  if (shippingOffered) return "Shipping only"
  return "Local pickup only"
}

export type PublicListingShippingCostMode = "reswell" | "flat" | "free"

/**
 * Dollar amount to render as flat shipping on a public listing.
 * Reswell-calculated and free shipping ignore a leftover `shipping_price`
 * from a previous flat-rate setting.
 */
export function flatShippingUsdForPublicListing(
  shippingPrice: number | string | null | undefined,
  shippingCostMode: PublicListingShippingCostMode | null | undefined,
): number {
  if (shippingCostMode === "reswell" || shippingCostMode === "free") return 0
  return Math.max(0, Number.parseFloat(String(shippingPrice ?? 0)) || 0)
}

/**
 * One label per enabled option for listing detail metadata.
 * Shipping is listed first when both options are offered.
 * Free and Reswell-calculated shipping say so even if `shipping_price` still holds an old flat amount.
 * A stored flat rate, or a legacy row with a price and no mode, includes the dollar amount.
 */
export function boardFulfillmentDetailLabels(
  localPickup: boolean | null | undefined,
  shippingAvailable: boolean | null | undefined,
  shippingPrice?: number | string | null,
  boardShippingCostMode?: PublicListingShippingCostMode | null,
): string[] {
  const labels: string[] = []
  if (shippingAvailable) {
    const n = flatShippingUsdForPublicListing(shippingPrice, boardShippingCostMode)
    const mode = boardShippingCostMode ?? null

    if (mode === "free") {
      labels.push("Free shipping")
    } else if (mode === "reswell") {
      labels.push("Shipping calculated at checkout")
    } else if (n > 0) {
      labels.push(`Shipping (+$${n.toFixed(2)})`)
    } else {
      labels.push("Shipping calculated at checkout")
    }
  }
  if (localPickup !== false) labels.push("Local pickup")
  return labels
}

export function isShippingFulfillmentLabel(label: string): boolean {
  return label.startsWith("Shipping") || label.startsWith("Free shipping")
}

/** Location-aware pickup line for listing PDPs. */
export function listingPickupCaption(
  pickupOffered: boolean,
  locationLine: string | null | undefined,
): string | null {
  if (!pickupOffered) return null
  const location = locationLine?.trim() || null
  return location ? `Local pickup in ${location}` : "Local pickup"
}

/**
 * Shipping line under list price. Drops pickup-only captions so pickup can
 * render as its own row instead of “Local pickup · shipping not offered”.
 */
export function listingShippingCaptionForPdp(
  shippingOffered: boolean,
  shippingPriceCaption: string | null | undefined,
): string | null {
  if (!shippingOffered) return null
  const caption = shippingPriceCaption?.trim() || null
  if (!caption) return "Shipping"
  if (/local pickup/i.test(caption)) return null
  return caption
}

/** Shared emphasis for shipping-at-checkout / free-shipping copy on listing PDPs. */
export const LISTING_SHIPPING_EMPHASIS_CLASS = "font-medium text-[#4263eb]"

/** Buyer checkout choice when listing offers both. */
export type BuyerFulfillmentMethod = "pickup" | "shipping"

export function buyerMethodAllowed(
  method: BuyerFulfillmentMethod,
  localPickup: boolean | null | undefined,
  shippingAvailable: boolean | null | undefined
): boolean {
  const lp = localPickup !== false
  const sa = !!shippingAvailable
  if (method === "pickup") return lp
  return sa
}
