/**
 * Single source of truth for seller balance.
 * All balance displays across the site should use this function.
 * Source: wallets table (tracks earnings from marketplace sales).
 */

import { SupabaseClient } from "@supabase/supabase-js"
import { reconcileWalletAggregates } from "./wallet-reconcile"

export async function getSellerBalance(supabase: SupabaseClient, userId: string) {
  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, balance, lifetime_earned, lifetime_spent, lifetime_cashed_out")
    .eq("user_id", userId)
    .single()

  if (!wallet) {
    return { balance: 0, lifetime_earned: 0, lifetime_spent: 0, lifetime_cashed_out: 0, walletId: null }
  }

  const r = reconcileWalletAggregates(wallet)

  return {
    balance: r.balance,
    lifetime_earned: parseFloat(String(wallet.lifetime_earned)) || 0,
    lifetime_spent: parseFloat(String(wallet.lifetime_spent)) || 0,
    lifetime_cashed_out: r.lifetime_cashed_out,
    walletId: wallet.id,
  }
}
