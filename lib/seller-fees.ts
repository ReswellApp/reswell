/**
 * Standard fees for peer surfboard sales on the platform.
 * Applied consistently to wallet and card (Stripe) purchases.
 *
 * Fee structure: Reswell takes 7% of the **listing (item) price** as the marketplace fee; the
 * seller receives 93% of the listing price. Shipping is collected separately from the buyer at
 * checkout, is **not** part of the seller's earnings, and is **not** subject to the marketplace
 * fee — Reswell uses it to cover the carrier label / fulfillment cost.
 *
 * Card processing (Stripe) is not deducted from the seller — Reswell absorbs it as a cost of
 * service. Buyer protection is funded from Reswell's platform fee, not charged to sellers.
 *
 * IMPORTANT: every caller must pass the **item price only** (never `item + shipping`). Order
 * totals (`orders.amount`) include shipping; subtract `orders.shipping_amount` first.
 */

/** Marketplace fee: 7% of the item (listing) price. Seller receives the remainder (93%). */
export const MARKETPLACE_FEE_PERCENT = 7

/** Seller share of the item price before cash-out (100% − marketplace fee). */
export const SELLER_SHARE_PERCENT = 100 - MARKETPLACE_FEE_PERCENT

/** Same fee as a decimal (e.g. admin math). */
export const RESWELL_FEE = MARKETPLACE_FEE_PERCENT / 100

/** Stripe processing rate: 2.9% (estimated platform cost on card payments — not deducted from seller). */
export const PAYMENT_PROCESSING_PERCENT = 2.9
/** Stripe processing fixed fee: $0.30 (estimated platform cost — not deducted from seller). */
export const PAYMENT_PROCESSING_FIXED = 0.3

/**
 * Marketplace (platform) fee for a given **item price** (excluding shipping).
 */
export function getMarketplaceFee(itemPriceUsd: number): number {
  return Math.round(itemPriceUsd * MARKETPLACE_FEE_PERCENT) / 100
}

/**
 * Estimated Stripe processing cost (2.9% + $0.30) for a card charge — for internal reference only.
 * This is not subtracted from seller earnings.
 */
export function getPaymentProcessingFee(price: number): number {
  return Math.round((price * PAYMENT_PROCESSING_PERCENT) / 100 * 100) / 100 + PAYMENT_PROCESSING_FIXED
}

export type SellerFeeOptions = {
  /** Reswell Seller program — no marketplace fee; seller receives 100% of item price. */
  feeWaived?: boolean
}

/**
 * Platform fee (7%) and seller earnings (93%) for a sale, computed from the **item price only**.
 * Shipping must be excluded by the caller; it is paid through to the carrier and never reaches
 * the seller.
 */
export function getSellerEarnings(
  itemPriceUsd: number,
  options?: SellerFeeOptions,
): {
  marketplaceFee: number
  sellerEarnings: number
} {
  if (options?.feeWaived) {
    const sellerEarnings = Math.round(itemPriceUsd * 100) / 100
    return { marketplaceFee: 0, sellerEarnings }
  }

  const marketplaceFee = getMarketplaceFee(itemPriceUsd)
  const sellerEarnings = Math.round((itemPriceUsd - marketplaceFee) * 100) / 100
  return { marketplaceFee, sellerEarnings }
}

/** Wallet / ledger copy for the fee portion of a pending sale description. */
export function pendingSaleFeeClause(platformFeeUsd: number): string {
  const fee = Math.max(0, platformFeeUsd)
  return `${MARKETPLACE_FEE_PERCENT}% fee: $${fee.toFixed(2)}`
}
