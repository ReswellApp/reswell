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

/**
 * One label per enabled option for listing detail metadata (e.g. condition · type · Local pickup · Shipping).
 * When the seller set a flat shipping amount, include it so buyers see the add-on clearly.
 * For Reswell-calculated shipping, `shipping_price` is often 0 until checkout; use `boardShippingCostMode`
 * so the listing can say the price is determined at checkout vs free shipping.
 */
export function boardFulfillmentDetailLabels(
  localPickup: boolean | null | undefined,
  shippingAvailable: boolean | null | undefined,
  shippingPrice?: number | string | null,
  boardShippingCostMode?: "reswell" | "flat" | "free" | null,
): string[] {
  const labels: string[] = []
  if (localPickup !== false) labels.push("Local pickup")
  if (shippingAvailable) {
    const n = Math.max(0, Number.parseFloat(String(shippingPrice ?? 0)) || 0)
    const mode = boardShippingCostMode ?? null

    if (mode === "free") {
      labels.push("Free shipping")
    } else if (n > 0) {
      labels.push(`Shipping (+$${n.toFixed(2)})`)
    } else if (mode === "reswell") {
      labels.push("Shipping (price determined in checkout)")
    } else {
      // Legacy rows (mode unknown) with $0 shipping, or flat $0: neutral copy
      labels.push("Shipping (rate at checkout)")
    }
  }
  return labels
}

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
