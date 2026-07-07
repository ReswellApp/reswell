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
