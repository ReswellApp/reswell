import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripeOptional } from "@/lib/stripe-client"

export const runtime = "nodejs"

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const stripe = getStripeOptional()
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured on this server." },
      { status: 503 }
    )
  }

  const { data: stripeAccount } = await supabase
    .from("seller_stripe_accounts")
    .select("stripe_account_id, payouts_enabled")
    .eq("user_id", user.id)
    .single()

  if (!stripeAccount?.stripe_account_id) {
    return NextResponse.json(
      { error: "No Stripe account found. Complete payout setup first." },
      { status: 400 }
    )
  }

  if (!stripeAccount.payouts_enabled) {
    return NextResponse.json(
      { error: "Payout account not yet active. Complete verification first." },
      { status: 400 }
    )
  }

  try {
    const loginLink = await stripe.accounts.createLoginLink(
      stripeAccount.stripe_account_id
    )
    return NextResponse.json({ url: loginLink.url })
  } catch (error) {
    console.error("[connect/dashboard-link] Error creating login link:", error)
    return NextResponse.json(
      { error: "Unable to open payout dashboard. Please try again." },
      { status: 500 }
    )
  }
}
