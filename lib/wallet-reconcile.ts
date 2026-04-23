/**
 * Wallet row aggregates should satisfy:
 *   balance + pending_balance ≈ lifetime_earned - lifetime_spent - max(0, lifetime_cashed_out)
 * `balance` may be negative when refunds reverse more than is still in-wallet (e.g. after a cash-out).
 * `pending_balance` is non-negative (seller hold until fulfillment).
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

  const pending0 = Math.max(0, parseNum(w.pending_balance))
  const balance0 = parseNum(w.balance)
  const totalHeld = balance0 + pending0
  const corruptCashed = cashedRaw < 0
  const drift = Math.abs(totalHeld - fromLedger) > DRIFT_EPS
  let needsPersist = corruptCashed || drift

  let balance = balance0
  let pending = pending0

  if (drift && !corruptCashed) {
    const t = fromLedger
    if (t < 0) {
      balance = round2(t - pending0)
      pending = pending0
    } else {
      if (pending0 <= t) {
        balance = round2(t - pending0)
        pending = pending0
      } else {
        pending = t
        balance = 0
      }
    }
  }

  const cashedForRow = needsPersist ? cashed : cashedRaw

  return {
    /**
     * Signed in-wallet (may be negative when refunds/reversals take back more than was left
     * on-platform after a cash-out or mix of buyer+seller activity).
     */
    balance,
    pending_balance: pending,
    /** In-wallet spendable: zero when the row is in refund debt. */
    availableBalance: Math.max(0, balance),
    /** Total Reswell Bucks in-wallet (pending + available; can be < pending if balance is negative). */
    totalBalance: round2(pending + balance),
    lifetime_cashed_out: cashedForRow,
    needsPersist,
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
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

/** Max amount safe to move to an external cash-out; same as `availableBalance` from reconcile. */
export function spendableReswellBucks(availableAfterReconcile: number): number {
  return round2(Math.max(0, availableAfterReconcile))
}
