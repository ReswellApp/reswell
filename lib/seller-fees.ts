/**
 * Standard fees for used gear sales on the platform.
 * Applied consistently to ReSwell Bucks and card (Stripe) purchases.
 */

/** Marketplace fee: 5% of sale price (platform fee) */
export const MARKETPLACE_FEE_PERCENT = 5

/** Payment processing: ~2.9% + $0.30 (Stripe; applied only for card payments) */
export const PAYMENT_PROCESSING_PERCENT = 2.9
export const PAYMENT_PROCESSING_FIXED = 0.3

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
