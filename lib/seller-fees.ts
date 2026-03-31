/**
 * Standard fees for used gear sales on the platform.
 * Applied consistently to Reswell Bucks and card (Stripe) purchases.
 *
 * Fee structure: Reswell takes 7%. Sellers keep 93%. No protection fund deduction.
 * Buyer protection is funded from Reswell's 7% platform fee — not charged to sellers.
 */

/** Marketplace fee: 7% of sale price (platform fee). Seller keeps 93%. */
export const MARKETPLACE_FEE_PERCENT = 7

/** Stripe processing rate: 2.9% (card payments only) */
export const PAYMENT_PROCESSING_PERCENT = 2.9
/** Stripe processing fixed fee: $0.30 (card payments only) */
export const PAYMENT_PROCESSING_FIXED = 0.3
// TODO: Confirm whether Stripe processing fee is passed to buyer at checkout or absorbed by Reswell

/**
 * Compute marketplace (platform) fee for a sale price.
 */
export function getMarketplaceFee(price: number): number {
  return Math.round(price * MARKETPLACE_FEE_PERCENT) / 100
}

/**
 * Compute payment processing fee (2.9% + $0.30) for card sales.
 */
export function getPaymentProcessingFee(price: number): number {
  return Math.round((price * PAYMENT_PROCESSING_PERCENT) / 100 * 100) / 100 + PAYMENT_PROCESSING_FIXED
}

/**
 * Seller earnings after fees.
 * @param price - Sale price
 * @param options.cardPayment - If true, deduct payment processing (~2.9% + $0.30) in addition to marketplace fee
 */
export function getSellerEarnings(
  price: number,
  options: { cardPayment?: boolean } = {}
): { marketplaceFee: number; paymentProcessingFee: number; sellerEarnings: number } {
  const marketplaceFee = getMarketplaceFee(price)
  const paymentProcessingFee = options.cardPayment ? getPaymentProcessingFee(price) : 0
  const sellerEarnings = Math.round((price - marketplaceFee - paymentProcessingFee) * 100) / 100
  return { marketplaceFee, paymentProcessingFee, sellerEarnings }
}
