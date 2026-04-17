"use server"

import { unstable_noStore as noStore } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { reconcileWalletAggregates, walletAggregateStrings } from "@/lib/wallet-reconcile"

export async function getEarningsWalletData() {
  noStore()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" as const, wallet: null, transactions: [] as unknown[] }
  }

  let { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", user.id).single()

  if (!wallet) {
    const { data: newWallet, error } = await supabase
      .from("wallets")
      .insert({ user_id: user.id })
      .select()
      .single()
    if (error) {
      return { error: "Failed to create wallet" as const, wallet: null, transactions: [] }
    }
    wallet = newWallet
  }

  const agg = reconcileWalletAggregates(wallet)
  if (agg.needsPersist) {
    const s = walletAggregateStrings(agg)
    await supabase
      .from("wallets")
      .update({
        balance: s.balance,
        pending_balance: s.pending_balance,
        lifetime_cashed_out: s.lifetime_cashed_out,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id)
    wallet = {
      ...wallet,
      balance: s.balance,
      pending_balance: s.pending_balance,
      lifetime_cashed_out: s.lifetime_cashed_out,
    }
  }

  const { data: txRows } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("wallet_id", wallet.id)
    .order("created_at", { ascending: false })
    .limit(50)

  return {
    wallet,
    transactions: txRows ?? [],
    paymentMethods: [] as unknown[],
    error: null,
  }
}
