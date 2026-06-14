import type { SupabaseClient } from "@supabase/supabase-js"
import {
  reconcileWalletAggregates,
  walletAggregateStrings,
  type WalletAggregateRow,
} from "@/lib/wallet-reconcile"

export type WalletReconcilePersistRow = WalletAggregateRow & { id: string }

/** Persists reconciled wallet aggregates when stored totals drift from ledger math. */
export async function persistWalletAggregatesIfNeeded(
  supabase: SupabaseClient,
  wallet: WalletReconcilePersistRow,
): Promise<void> {
  const r = reconcileWalletAggregates(wallet)
  if (!r.needsPersist) return

  const s = walletAggregateStrings(r)
  await supabase
    .from("wallets")
    .update({
      balance: s.balance,
      pending_balance: s.pending_balance,
      lifetime_cashed_out: s.lifetime_cashed_out,
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallet.id)
}
