export type CheckoutShippingPriceStatus =
  | "pickup"
  | "pending"
  | "calculating"
  | "unavailable"
  | "free"
  | "priced"

export type CheckoutShippingPriceDisplay = {
  status: CheckoutShippingPriceStatus
  label: string
  /** Dollars to include in the order total. Null when the price is not known yet. */
  amountUsd: number | null
}

/**
 * What the checkout order summary should show for delivery.
 *
 * Flat and free rates are known from the listing. Calculated carrier rates stay
 * blank until a shipping address exists, then show the quoted amount.
 */
export function resolveCheckoutShippingPriceDisplay(input: {
  needsShipping: boolean
  /** Live carrier quote or Surfboard Shipped — the destination changes the price. */
  priceDependsOnAddress: boolean
  hasShippingAddress: boolean
  quoteLoading: boolean
  quoteError: string | null
  shippingUsd: number | null
}): CheckoutShippingPriceDisplay {
  if (!input.needsShipping) {
    return { status: "pickup", label: "Local pickup", amountUsd: 0 }
  }

  if (input.priceDependsOnAddress) {
    if (!input.hasShippingAddress) {
      return { status: "pending", label: "—", amountUsd: null }
    }
    if (input.quoteLoading) {
      return { status: "calculating", label: "Calculating…", amountUsd: null }
    }
    if (input.quoteError || input.shippingUsd == null) {
      return input.quoteError
        ? { status: "unavailable", label: "Unavailable", amountUsd: null }
        : { status: "calculating", label: "Calculating…", amountUsd: null }
    }
  } else if (input.quoteError || input.shippingUsd == null) {
    return input.quoteError
      ? { status: "unavailable", label: "Unavailable", amountUsd: null }
      : { status: "pending", label: "—", amountUsd: null }
  }

  const amount = input.shippingUsd ?? 0
  if (amount === 0) {
    return { status: "free", label: "Free", amountUsd: 0 }
  }
  return {
    status: "priced",
    label: `$${amount.toFixed(2)}`,
    amountUsd: amount,
  }
}
