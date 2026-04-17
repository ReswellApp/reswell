/**
 * Allocate a seller refund clawback across `pending_balance` (pre-delivery) then spendable `balance`.
 * Do not rely on `payouts.status`: async refunds set payouts to `cancelled` before the webhook runs,
 * which would otherwise hide whether funds were still pending or already released.
 */
export function splitSellerRefundClawback(
  clawbackUsd: number,
  prevPending: number,
  prevBalance: number,
): {
  clawFromPending: number
  clawFromBalance: number
  totalClawed: number
  newPending: number
  newBalance: number
} {
  const roundMoney = (n: number) => Math.round(n * 100) / 100
  const p = Math.max(0, prevPending)
  const b = Math.max(0, prevBalance)
  const clawFromPending = roundMoney(Math.min(clawbackUsd, p))
  const remainder = roundMoney(Math.max(0, clawbackUsd - clawFromPending))
  const clawFromBalance = roundMoney(Math.min(remainder, b))
  return {
    clawFromPending,
    clawFromBalance,
    totalClawed: roundMoney(clawFromPending + clawFromBalance),
    newPending: roundMoney(Math.max(0, p - clawFromPending)),
    newBalance: roundMoney(Math.max(0, b - clawFromBalance)),
  }
}
