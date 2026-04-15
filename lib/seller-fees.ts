/**
 * Standard fees for peer surfboard sales on the platform.
 * Applied consistently to Reswell Bucks and card (Stripe) purchases.
 *
 * Fee structure: Reswell takes 7% of the sale total as the marketplace fee; the seller receives 93%.
 * Card processing (Stripe) is not deducted from the seller — it is absorbed by Reswell as a cost of service.
 * Buyer protection is funded from Reswell's platform fee — not charged to sellers.
 */

/** Marketplace fee: 7% of sale price (platform fee). Seller receives the remainder (93%). */
export const MARKETPLACE_FEE_PERCENT = 7

/** Seller share of the sale price before cash-out (100% − marketplace fee). */
export const SELLER_SHARE_PERCENT = 100 - MARKETPLACE_FEE_PERCENT

/** Same fee as a decimal (e.g. admin math). */
export const RESWELL_FEE = MARKETPLACE_FEE_PERCENT / 100

/** Stripe processing rate: 2.9% (estimated platform cost on card payments — not deducted from seller). */
export const PAYMENT_PROCESSING_PERCENT = 2.9
/** Stripe processing fixed fee: $0.30 (estimated platform cost — not deducted from seller). */
export const PAYMENT_PROCESSING_FIXED = 0.3

/**
 * Compute marketplace (platform) fee for a sale price.
 */
export function getMarketplaceFee(price: number): number {
  return Math.round(price * MARKETPLACE_FEE_PERCENT) / 100
}

/**
 * Estimated Stripe processing cost (2.9% + $0.30) for a card charge — for internal reference only.
 * This is not subtracted from seller earnings.
 */
export function getPaymentProcessingFee(price: number): number {
  return Math.round((price * PAYMENT_PROCESSING_PERCENT) / 100 * 100) / 100 + PAYMENT_PROCESSING_FIXED
}

/**
 * Platform fee (7%) and seller earnings (93%) for a sale total.
 * Same split for Reswell Bucks and card: the seller always receives sale total minus the marketplace fee only.
 */
export function getSellerEarnings(price: number): {
  marketplaceFee: number
  sellerEarnings: number
} {
  const marketplaceFee = getMarketplaceFee(price)
  const sellerEarnings = Math.round((price - marketplaceFee) * 100) / 100
  return { marketplaceFee, sellerEarnings }
}
