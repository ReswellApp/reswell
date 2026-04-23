/**
 * Single source of truth for seller balance.
 * All balance displays across the site should use this function.
 * Source: wallets table (tracks earnings from marketplace sales).
 */

import { SupabaseClient } from "@supabase/supabase-js"
import { reconcileWalletAggregates, spendableReswellBucks } from "./wallet-reconcile"

export async function getSellerBalance(supabase: SupabaseClient, userId: string) {
  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, balance, pending_balance, lifetime_earned, lifetime_spent, lifetime_cashed_out")
    .eq("user_id", userId)
    .single()

  if (!wallet) {
    return {
      balance: 0,
      pendingBalance: 0,
      totalBalance: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
      lifetime_cashed_out: 0,
      /** In-wallet Reswell that can be spent or cashed (never negative in this shape). */
      spendableBucks: 0,
      /** Amount owed the platform in-wallet (refunds after cash-out, etc.); 0 if none. */
      inWalletOwed: 0,
      walletId: null,
    }
  }

  const r = reconcileWalletAggregates(wallet)
  const owed = r.balance < 0 ? -r.balance : 0

  return {
    balance: r.availableBalance,
    pendingBalance: r.pending_balance,
    totalBalance: r.totalBalance,
    lifetime_earned: parseFloat(String(wallet.lifetime_earned)) || 0,
    lifetime_spent: parseFloat(String(wallet.lifetime_spent)) || 0,
    lifetime_cashed_out: r.lifetime_cashed_out,
    spendableBucks: spendableReswellBucks(r.availableBalance),
    inWalletOwed: Math.round(owed * 100) / 100,
    walletId: wallet.id,
  }
}
