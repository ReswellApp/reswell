/**
 * Wallet row aggregates should satisfy:
 *   balance + pending_balance ≈ lifetime_earned - lifetime_spent - max(0, lifetime_cashed_out)
 * where `balance` is spendable / cash-outable Reswell Bucks and `pending_balance` is seller earnings
 * held until fulfillment.
 */

const DRIFT_EPS = 0.02

export type WalletAggregateRow = {
  balance?: string | number | null
  pending_balance?: string | number | null
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

  let pending = Math.max(0, parseNum(w.pending_balance))
  let balance = Math.max(0, parseNum(w.balance))
  const totalHeld = balance + pending
  const corruptCashed = cashedRaw < 0
  const drift = Math.abs(totalHeld - fromLedger) > DRIFT_EPS
  let needsPersist = corruptCashed || drift

  if (drift && !corruptCashed) {
    const target = Math.max(0, fromLedger)
    if (pending <= target) {
      balance = Math.round((target - pending) * 100) / 100
    } else {
      pending = target
      balance = 0
    }
  }

  const lifetime_cashed_out = needsPersist ? cashed : cashedRaw

  return {
    balance,
    pending_balance: pending,
    /** Spendable + cash-outable only (excludes pending seller holds). */
    availableBalance: balance,
    /** Total Reswell Bucks including pending seller earnings (for display). */
    totalBalance: Math.round((balance + pending) * 100) / 100,
    lifetime_cashed_out,
    needsPersist,
  }
}

export function walletAggregateStrings(r: {
  balance: number
  pending_balance: number
  lifetime_cashed_out: number
}) {
  return {
    balance: r.balance.toFixed(2),
    pending_balance: r.pending_balance.toFixed(2),
    lifetime_cashed_out: r.lifetime_cashed_out.toFixed(2),
  }
}
