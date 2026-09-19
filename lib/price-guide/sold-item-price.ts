import { marketplaceGmvExcludingShippingUsd } from "../seller-fees.ts"

/** Reswell checkout sold price: merchandise only, never buyer-paid shipping. */
export function priceGuideOrderSoldUsd(order: {
  amount?: number | string | null
  shipping_amount?: number | string | null
}): number | null {
  const price = marketplaceGmvExcludingShippingUsd(order)
  return price > 0 ? price : null
}
