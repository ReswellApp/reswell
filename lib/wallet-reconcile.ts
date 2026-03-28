/**
 * Wallet row aggregates should satisfy:
 *   balance ≈ lifetime_earned - lifetime_spent - max(0, lifetime_cashed_out)
 * (cash-out requests deduct balance and increment lifetime_cashed_out together.)
 * Negative lifetime_cashed_out or drift breaks the dashboard until reconciled.
 */

const DRIFT_EPS = 0.02

export type WalletAggregateRow = {
  balance?: string | number | null
  lifetime_earned?: string | number | null
  lifetime_spent?: string | number | null
  lifetime_cashed_out?: string | number | null
}

function parseNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === "number" ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : 0
}

export function reconcileWalletAggregates(w: WalletAggregateRow) {
  const earned = parseNum(w.lifetime_earned)
  const spent = parseNum(w.lifetime_spent)
  const cashedRaw = parseNum(w.lifetime_cashed_out)
  const cashed = Math.max(0, cashedRaw)
  const fromLedger = Math.round((earned - spent - cashed) * 100) / 100
  const rawBalance = parseNum(w.balance)
  const corruptCashed = cashedRaw < 0
  const drift = Math.abs(rawBalance - fromLedger) > DRIFT_EPS
  const needsPersist = corruptCashed || drift
  const balance = Math.max(0, needsPersist ? fromLedger : rawBalance)
  const lifetime_cashed_out = needsPersist ? cashed : cashedRaw
  return { balance, lifetime_cashed_out, needsPersist }
}

export function walletAggregateStrings(r: { balance: number; lifetime_cashed_out: number }) {
  return {
    balance: r.balance.toFixed(2),
    lifetime_cashed_out: r.lifetime_cashed_out.toFixed(2),
  }
}
