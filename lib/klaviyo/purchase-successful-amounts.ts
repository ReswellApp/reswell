/**
 * Order-page amounts for the buyer **Purchase Successful** Klaviyo event.
 * Listing price matches the admin order "Item price": buyer order total minus shipping.
 */

export type PurchaseSuccessfulOrderAmounts = {
  /** Item price on the order page (order total − buyer-paid shipping). */
  listingPrice: number
  orderTotal: number
  shippingPaidByBuyer: number
  platformFee: number
  sellerEarnings: number
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

export function purchaseSuccessfulOrderAmounts(input: {
  orderTotalUsd: number
  shippingAmountUsd?: number | null
  platformFeeUsd?: number | null
  sellerEarningsUsd?: number | null
}): PurchaseSuccessfulOrderAmounts {
  const orderTotal = roundMoney(Number(input.orderTotalUsd) || 0)
  const shippingPaidByBuyer = Math.max(0, roundMoney(Number(input.shippingAmountUsd ?? 0) || 0))
  return {
    listingPrice: Math.max(0, roundMoney(orderTotal - shippingPaidByBuyer)),
    orderTotal,
    shippingPaidByBuyer,
    platformFee: Math.max(0, roundMoney(Number(input.platformFeeUsd ?? 0) || 0)),
    sellerEarnings: Math.max(0, roundMoney(Number(input.sellerEarningsUsd ?? 0) || 0)),
  }
}
