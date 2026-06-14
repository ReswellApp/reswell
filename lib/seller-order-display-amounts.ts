/**
 * Seller-facing order amounts — promo discounts are Reswell-funded and must not
 * reduce `seller_earnings`, `platform_fee`, or `order_items.item_price` (see checkout finalize).
 * Use these helpers anywhere sellers see sale totals so UI matches ledger math.
 */

export type SellerOrderAmountFields = {
  amount: number | string
  shipping_amount?: number | string | null
  platform_fee?: number | string | null
  seller_earnings: number | string
  promo_discount_usd?: number | string | null
}

export type SellerOrderDisplayAmounts = {
  /** What the buyer was charged (may include a Reswell promo discount). */
  buyerPaidTotal: number
  /** Reswell-funded discount on item price (0 when none). */
  promoDiscountUsd: number
  shippingAmount: number
  /** Full listing item price — basis for platform fee and seller earnings. */
  itemPriceAmount: number
  platformFee: number
  sellerEarningsAmount: number
  /** Item + shipping at listing rates (seller-facing “sale total”). */
  sellerSaleTotal: number
  hadReswellPromo: boolean
}

export function resolveSellerOrderDisplayAmounts(
  order: SellerOrderAmountFields,
): SellerOrderDisplayAmounts {
  const buyerPaidTotal = Number(order.amount)
  const shippingAmount = Math.max(0, Number(order.shipping_amount ?? 0) || 0)
  const sellerEarningsAmount = Number(order.seller_earnings)
  const promoDiscountUsd = Math.max(0, Number(order.promo_discount_usd ?? 0) || 0)

  const storedPlatformFee = Number(order.platform_fee ?? NaN)
  const platformFee =
    Number.isFinite(storedPlatformFee) && storedPlatformFee >= 0
      ? storedPlatformFee
      : Math.max(
          0,
          Math.round((buyerPaidTotal - shippingAmount + promoDiscountUsd - sellerEarningsAmount) * 100) /
            100,
        )

  const itemPriceAmount = Math.max(
    0,
    Math.round((sellerEarningsAmount + platformFee) * 100) / 100,
  )

  const sellerSaleTotal = Math.round((itemPriceAmount + shippingAmount) * 100) / 100

  return {
    buyerPaidTotal,
    promoDiscountUsd,
    shippingAmount,
    itemPriceAmount,
    platformFee,
    sellerEarningsAmount,
    sellerSaleTotal,
    hadReswellPromo: promoDiscountUsd > 0,
  }
}
