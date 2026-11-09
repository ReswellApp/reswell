import {
  normalizeSellShippingCostMode,
  type ListingPersistShippingOptions,
} from "@/lib/sell-shipping-cost-mode"

export type ShipOnlyListingShippingInput = {
  shippingCostMode?: string | null
  shippingPrice?: number | null
}

/** Persist columns for categories that ship only (mirrors `finListingShippingFieldsFor`). */
export function shipOnlyListingShippingFieldsFor(
  input: ShipOnlyListingShippingInput,
  options?: ListingPersistShippingOptions,
): {
  shipping_available: boolean
  local_pickup: boolean
  shipping_price: number | null
  board_shipping_cost_mode: string | null
} {
  const mode = normalizeSellShippingCostMode(
    input.shippingCostMode,
    options?.allowPrivilegedShippingModes === true,
  )
  if (mode === "free") {
    return {
      shipping_available: true,
      local_pickup: false,
      shipping_price: 0,
      board_shipping_cost_mode: "free",
    }
  }
  if (mode === "reswell") {
    return {
      shipping_available: true,
      local_pickup: false,
      shipping_price: 0,
      board_shipping_cost_mode: "reswell",
    }
  }
  return {
    shipping_available: true,
    local_pickup: false,
    shipping_price: input.shippingPrice ?? 0,
    board_shipping_cost_mode: "flat",
  }
}
