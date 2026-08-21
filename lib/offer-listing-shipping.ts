import { effectiveBoardShippingMode } from "@/lib/services/peerListingShippingQuote"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export type OfferShippingCostMode = "reswell" | "flat" | "free"

export type ListingForOfferShipping = {
  section?: string | null
  shipping_available?: boolean | null
  local_pickup?: boolean | null
  shipping_price?: string | number | null
  board_shipping_cost_mode?: string | null
}

/** Snapshot stored on offers.shipping_amount — never negotiated. */
export function offerShippingAmountFromListing(
  listing: ListingForOfferShipping,
  fulfillment: "pickup" | "shipping",
): number | null {
  if (fulfillment !== "shipping") return null
  const mode = effectiveBoardShippingMode(listing)
  if (mode === "reswell") return null
  if (mode === "free") return 0
  const n = Math.max(0, parseFloat(String(listing.shipping_price ?? 0)) || 0)
  return roundMoney(n)
}

export function normalizeOfferFulfillment(
  value: string | null | undefined,
): "pickup" | "shipping" | null {
  return value === "pickup" || value === "shipping" ? value : null
}

/**
 * Align an offer’s delivery choice with the listing’s current fulfillment flags
 * (e.g. after oversize boards were switched to pickup-only).
 */
export function reconcileOfferFulfillmentWithListing(
  offerFulfillment: string | null | undefined,
  listing: ListingForOfferShipping,
): {
  fulfillment: "pickup" | "shipping" | null
  shippingAmount: number | null
  adjusted: boolean
  reason: string | null
} {
  const pickupOk = listing.local_pickup !== false
  const shipOk = !!listing.shipping_available
  const requested = normalizeOfferFulfillment(offerFulfillment)

  if (!pickupOk && !shipOk) {
    return {
      fulfillment: null,
      shippingAmount: null,
      adjusted: requested != null,
      reason: "This listing no longer has a delivery method.",
    }
  }

  let fulfillment: "pickup" | "shipping"
  let adjusted = false
  let reason: string | null = null

  if (requested === "shipping") {
    if (shipOk) {
      fulfillment = "shipping"
    } else if (pickupOk) {
      fulfillment = "pickup"
      adjusted = true
      reason = "Shipping is no longer available for this listing — delivery is local pickup."
    } else {
      return {
        fulfillment: null,
        shippingAmount: null,
        adjusted: true,
        reason: "Shipping is no longer available for this listing.",
      }
    }
  } else if (requested === "pickup") {
    if (pickupOk) {
      fulfillment = "pickup"
    } else if (shipOk) {
      fulfillment = "shipping"
      adjusted = true
      reason = "Local pickup is no longer available — delivery is shipping."
    } else {
      return {
        fulfillment: null,
        shippingAmount: null,
        adjusted: true,
        reason: "Local pickup is no longer available for this listing.",
      }
    }
  } else {
    // Legacy offers with null fulfillment — prefer listing-only option, else pickup.
    fulfillment = shipOk && !pickupOk ? "shipping" : pickupOk ? "pickup" : "shipping"
    adjusted = true
    reason = null
  }

  return {
    fulfillment,
    shippingAmount: offerShippingAmountFromListing(listing, fulfillment),
    adjusted,
    reason,
  }
}

/** Buyer/seller offer UI copy for listing shipping (not a negotiated amount). */
export function offerShippingCostLabel(
  mode: OfferShippingCostMode | null | undefined,
  flatRate: number,
): string {
  if (mode === "free") return "Free"
  if (mode === "flat") {
    const n = Math.max(0, flatRate)
    return n > 0 ? `$${n.toFixed(2)}` : "Free"
  }
  return "Calculated at checkout"
}

export function offerShippingCostHint(
  mode: OfferShippingCostMode | null | undefined,
  flatRate: number,
): string {
  if (mode === "free") return "This listing includes free shipping."
  if (mode === "flat") {
    const n = Math.max(0, flatRate)
    return n > 0
      ? `Listing flat shipping ($${n.toFixed(2)}) is charged at checkout — not negotiated.`
      : "This listing includes free shipping."
  }
  return "Reswell calculates carrier shipping at checkout from your address — not negotiated."
}
