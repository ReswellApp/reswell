import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripeOptional } from "@/lib/stripe-client"

export const runtime = "nodejs"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: stripeAccount } = await supabase
    .from("seller_stripe_accounts")
    .select("stripe_account_id, payouts_enabled")
    .eq("user_id", user.id)
    .single()

  if (!stripeAccount?.stripe_account_id) {
    return NextResponse.json({ available: 0, pending: 0, connected: false })
  }

  const stripe = getStripeOptional()
  if (!stripe) {
    return NextResponse.json({ available: 0, pending: 0, connected: true, stripeUnavailable: true })
  }

  try {
    const balance = await stripe.balance.retrieve(
      {},
      { stripeAccount: stripeAccount.stripe_account_id }
    )

    const available =
      balance.available.reduce((sum, b) => sum + b.amount, 0) / 100

    const pending =
      balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100

    return NextResponse.json({
      available,
      pending,
      connected: true,
      payoutsEnabled: stripeAccount.payouts_enabled,
    })
  } catch (error) {
    console.error("[connect/balance] Failed to fetch Stripe balance:", error)
    return NextResponse.json({ available: 0, pending: 0, connected: true, error: "balance_fetch_failed" })
  }
}
