import { createClient } from "@/lib/supabase/server"
import { reconcileWalletAggregates, walletAggregateStrings } from "@/lib/wallet-reconcile"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Fetch or create wallet
  let { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!wallet) {
    const { data: newWallet, error } = await supabase
      .from("wallets")
      .insert({ user_id: user.id })
      .select()
      .single()
    if (error) return NextResponse.json({ error: "Failed to create wallet" }, { status: 500 })
    wallet = newWallet
  }

  // Reconcile and persist if drifted
  const agg = reconcileWalletAggregates(wallet)
  if (agg.needsPersist) {
    const s = walletAggregateStrings(agg)
    await supabase
      .from("wallets")
      .update({ balance: s.balance, lifetime_cashed_out: s.lifetime_cashed_out, updated_at: new Date().toISOString() })
      .eq("id", wallet.id)
    wallet = { ...wallet, balance: s.balance, lifetime_cashed_out: s.lifetime_cashed_out }
  }

  const { data: txRows } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("wallet_id", wallet.id)
    .order("created_at", { ascending: false })
    .limit(50)

  return NextResponse.json({
    wallet,
    transactions: txRows ?? [],
    paymentMethods: [],
  })
}
