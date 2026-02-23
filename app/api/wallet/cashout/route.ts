import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getPayoutFee, getPayoutNetAmount, type PayoutType } from "@/lib/payout-fees"

const MIN_CASHOUT = 10 // Minimum $10 to cash out

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { amount, payment_method, payment_email, payout_type: rawPayoutType } = await request.json()

  if (!amount || !payment_method || !payment_email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const payout_type: PayoutType = rawPayoutType === "instant" ? "instant" : "standard"
  const cashoutAmount = parseFloat(amount)

  if (cashoutAmount < MIN_CASHOUT) {
    return NextResponse.json(
      { error: `Minimum cash-out is R$${MIN_CASHOUT}.00` },
      { status: 400 }
    )
  }

  // Fetch wallet
  const { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!wallet || parseFloat(wallet.balance) < cashoutAmount) {
    return NextResponse.json(
      { error: "Insufficient balance", balance: wallet?.balance || 0 },
      { status: 400 }
    )
  }

  const fee = getPayoutFee(cashoutAmount, payout_type)
  const netAmount = getPayoutNetAmount(cashoutAmount, payout_type)
  const newBalance = parseFloat(wallet.balance) - cashoutAmount

  // Deduct from wallet
  const { error: updateError } = await supabase
    .from("wallets")
    .update({
      balance: newBalance,
      lifetime_cashed_out: parseFloat(wallet.lifetime_cashed_out) + cashoutAmount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallet.id)

  if (updateError) {
    return NextResponse.json({ error: "Failed to process cash-out" }, { status: 500 })
  }

  // Create cashout request
  const { data: cashout } = await supabase
    .from("cashout_requests")
    .insert({
      user_id: user.id,
      wallet_id: wallet.id,
      amount: cashoutAmount,
      fee,
      net_amount: netAmount,
      payment_method,
      payment_email,
    })
    .select()
    .single()

  // Create transaction record
  await supabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: user.id,
    type: "cashout",
    amount: -cashoutAmount,
    balance_after: newBalance,
    description: `Cash-out R$${cashoutAmount.toFixed(2)} via ${payment_method} (${payout_type}, fee: R$${fee.toFixed(2)}, payout: $${netAmount.toFixed(2)})`,
    reference_id: cashout?.id,
    reference_type: "cashout_request",
    status: "pending",
  })

  return NextResponse.json({
    success: true,
    cashout,
    newBalance,
    fee,
    netAmount,
  })
}
