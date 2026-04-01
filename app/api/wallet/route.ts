import { createClient } from "@/lib/supabase/server"
import { reconcileWalletAggregates, walletAggregateStrings } from "@/lib/wallet-reconcile"
import { NextResponse } from "next/server"

// GET: Fetch wallet balance + recent transactions
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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

    if (error) {
      return NextResponse.json({ error: "Failed to create wallet" }, { status: 500 })
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
        lifetime_cashed_out: s.lifetime_cashed_out,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id)
    // Always return the reconciled values so the client sees the correct balance,
    // even if the DB write fails (e.g. a transient error).
    wallet = {
      ...wallet,
      balance: s.balance,
      lifetime_cashed_out: s.lifetime_cashed_out,
    }
  }

  // Fetch recent transactions
  const { data: transactions } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("wallet_id", wallet.id)
    .order("created_at", { ascending: false })
    .limit(20)

  // Fetch pending cashout requests
  const { data: pendingCashouts } = await supabase
    .from("cashout_requests")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })

  return NextResponse.json({
    wallet,
    transactions: transactions || [],
    pendingCashouts: pendingCashouts || [],
  })
}
