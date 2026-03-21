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
  }
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
