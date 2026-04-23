/**
 * Allocate a seller refund clawback across `pending_balance` (pre-delivery) then `balance`
 * (spendable; may go negative to reflect amounts already externalized, e.g. a prior cash-out).
 */
export function splitSellerRefundClawback(
  clawbackUsd: number,
  prevPending: number,
  prevBalance: number,
): {
  clawFromPending: number
  remainderFromAvailable: number
  /** Full seller share of the refund; equals clawFromPending + amount taken from (or added as debt to) balance. */
  totalClawed: number
  newPending: number
  newBalance: number
} {
  const roundMoney = (n: number) => Math.round(n * 100) / 100
  const p = Math.max(0, prevPending)
  const b = prevBalance
  const clawFromPending = roundMoney(Math.min(clawbackUsd, p))
  const remainder = roundMoney(Math.max(0, clawbackUsd - clawFromPending))
  const newPending = roundMoney(Math.max(0, p - clawFromPending))
  const newBalance = roundMoney(b - remainder)
  return {
    clawFromPending,
    remainderFromAvailable: remainder,
    totalClawed: roundMoney(clawbackUsd),
    newPending,
    newBalance,
  }
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Reverses the full seller-earnings share of this refund in our books: debits pending then balance
 * (balance may be negative) and always reduces `lifetime_earned` by the same refund share.
 */
export function applySellerRefundClawback(
  prev: { balance: number; pending: number; lifetimeEarned: number },
  clawbackUsd: number,
): {
  split: ReturnType<typeof splitSellerRefundClawback>
  newLifetimeEarned: number
} {
  const split = splitSellerRefundClawback(clawbackUsd, prev.pending, prev.balance)
  const newLifetimeEarned = roundMoney(Math.max(0, prev.lifetimeEarned - clawbackUsd))
  return { split, newLifetimeEarned }
}
