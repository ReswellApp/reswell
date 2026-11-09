/** Reswell Credit rates and caps (loyalty store credit — never cashable). */

/** 1 Reswell Credit dollar = 100 cents on the credit ledger. */
export const RESWELL_CREDIT_CENTS_PER_USD = 100

/** Buyer earn rate on item subtotal (completed purchase). */
export const RESWELL_CREDIT_BUY_EARN_RATE = 0.02

/** Seller earn rate on seller_earnings when payout releases to Bucks. */
export const RESWELL_CREDIT_SELL_EARN_RATE = 0.03

/** Max fraction of item subtotal payable with Reswell Credit at checkout. */
export const RESWELL_CREDIT_MAX_CHECKOUT_FRACTION = 0.5

/** Stripe card minimum — Credit cannot push cash charge below this. */
export const RESWELL_CREDIT_MIN_CARD_CHARGE_USD = 0.5

export function usdToCreditCents(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0
  return Math.max(0, Math.round(usd * RESWELL_CREDIT_CENTS_PER_USD))
}

export function creditCentsToUsd(cents: number): number {
  if (!Number.isFinite(cents) || cents <= 0) return 0
  return Math.round(cents) / RESWELL_CREDIT_CENTS_PER_USD
}

export function computeBuyerCreditEarnCents(itemSubtotalUsd: number): number {
  return usdToCreditCents(itemSubtotalUsd * RESWELL_CREDIT_BUY_EARN_RATE)
}

export function computeSellerCreditEarnCents(sellerEarningsUsd: number): number {
  return usdToCreditCents(sellerEarningsUsd * RESWELL_CREDIT_SELL_EARN_RATE)
}

/**
 * Max Credit (cents) that can apply on a checkout line bundle.
 * Caps at 50% of item subtotal, available balance, and leaving at least $0.50 for card.
 */
export function computeMaxReswellCreditApplyCents(params: {
  itemSubtotalUsd: number
  shippingUsd: number
  promoDiscountUsd: number
  availableCreditCents: number
}): number {
  const itemCents = usdToCreditCents(params.itemSubtotalUsd)
  const shippingCents = usdToCreditCents(params.shippingUsd)
  const promoCents = usdToCreditCents(params.promoDiscountUsd)
  const totalAfterPromo = Math.max(0, itemCents + shippingCents - promoCents)
  const halfItems = Math.floor(itemCents * RESWELL_CREDIT_MAX_CHECKOUT_FRACTION)
  const minCardCents = usdToCreditCents(RESWELL_CREDIT_MIN_CARD_CHARGE_USD)
  const roomAboveMinCard = Math.max(0, totalAfterPromo - minCardCents)
  const available = Math.max(0, Math.floor(params.availableCreditCents))
  return Math.max(0, Math.min(halfItems, roomAboveMinCard, available))
}
