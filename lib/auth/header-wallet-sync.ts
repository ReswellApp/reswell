import { reconcileWalletAggregates, type WalletAggregateRow } from "@/lib/wallet-reconcile"
import { dispatchHeaderAuthRefresh } from "@/lib/auth/header-auth-refresh"

/** Same total as the earnings Balance card ("Total including pending"). */
export function walletTotalBalanceUsd(row: WalletAggregateRow): number {
  return reconcileWalletAggregates(row).totalBalance
}

/** Push reconciled wallet totals into the site header without a full page refresh. */
export function dispatchHeaderWalletSync(row: WalletAggregateRow): void {
  dispatchHeaderAuthRefresh({ walletTotalBalance: walletTotalBalanceUsd(row) })
}

export type HeaderWalletQueryResult = {
  data: WalletAggregateRow | null | undefined
  error?: { code?: string; message?: string } | null
}

/**
 * Header Earnings amount from a wallets read.
 * - Row present → reconciled total (ready + pending)
 * - No row → $0.00 (new account, or wallet not created yet)
 * - Query failed → null so the menu can keep last-known / show loading instead of a fake $0.00
 */
export function resolveHeaderWalletBalance(result: HeaderWalletQueryResult): number | null {
  if (result.data) return walletTotalBalanceUsd(result.data)
  const code = result.error?.code
  // PostgREST: .single() with 0 rows. .maybeSingle() returns data=null without error.
  if (!result.error || code === "PGRST116") return 0
  return null
}
