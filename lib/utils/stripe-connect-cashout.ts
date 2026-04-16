/** Platform fee on instant bank payouts (Stripe Connect cash-out). */
export const STRIPE_INSTANT_BANK_PAYOUT_FEE_RATE = 0.015

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function instantBankPayoutFeeUsd(grossCashOutUsd: number): number {
  return roundMoney(grossCashOutUsd * STRIPE_INSTANT_BANK_PAYOUT_FEE_RATE)
}

/** Amount sent to Stripe Connect (and to the seller’s bank after payout) after the instant fee. */
export function netUsdAfterInstantBankFee(grossCashOutUsd: number): number {
  return roundMoney(grossCashOutUsd - instantBankPayoutFeeUsd(grossCashOutUsd))
}
