import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { reconcileWalletAggregates, walletAggregateStrings } from "@/lib/wallet-reconcile"

export const runtime = "nodejs"

/** GET: wallet balance + payout history (legacy `payouts` table). Bank/payment-method storage removed. */
export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", user.id).single()

  if (!wallet) {
    const { data: created, error } = await supabase
      .from("wallets")
      .insert({ user_id: user.id })
      .select()
      .single()
    if (error) {
      return NextResponse.json({ error: "Could not load wallet" }, { status: 500 })
    }
    wallet = created
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
    wallet = { ...wallet, balance: s.balance, lifetime_cashed_out: s.lifetime_cashed_out }
  }

  const available = parseFloat(String(wallet.balance ?? "0"))

  const { data: payoutsRows } = await supabase
    .from("payouts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  return NextResponse.json({
    balance: {
      available_balance: available,
      pending_balance: 0,
      reswell_credit: 0,
      lifetime_earned: parseFloat(String(wallet.lifetime_earned ?? "0")),
      lifetime_paid_out: parseFloat(String(wallet.lifetime_cashed_out ?? "0")),
    },
    payouts: payoutsRows ?? [],
    paymentMethods: [],
    stripeAccount: null,
  })
}

/**
 * POST payout requests — disabled. Use PayPal cashout (`/api/payouts/paypal`) or wallet flows.
 */
export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json(
    {
      error:
        "This payout path is retired. Use PayPal payout from Earnings, or Reswell Bucks in the wallet.",
    },
    { status: 410 },
  )
}
