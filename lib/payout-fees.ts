/**
 * Payout (cash-out) fee structure for cashing out ReSwell Bucks to real currency.
 */

export type PayoutType = "standard" | "instant"

/** Standard payout: 0% fee (typical processing time) */
export const STANDARD_PAYOUT_FEE_PERCENT = 0

/** Instant payout: 1% fee (faster transfer to real currency) */
export const INSTANT_PAYOUT_FEE_PERCENT = 1

export function getPayoutFeePercent(type: PayoutType): number {
  return type === "instant" ? INSTANT_PAYOUT_FEE_PERCENT : STANDARD_PAYOUT_FEE_PERCENT
}

export function getPayoutFee(amount: number, type: PayoutType): number {
  const pct = getPayoutFeePercent(type)
  return Math.round(amount * pct) / 100
}

export function getPayoutNetAmount(amount: number, type: PayoutType): number {
  return Math.round((amount - getPayoutFee(amount, type)) * 100) / 100
}
