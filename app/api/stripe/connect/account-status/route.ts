import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe-server"

export const runtime = "nodejs"

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: account } = await supabase
    .from("seller_stripe_accounts")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!account) {
    return NextResponse.json({ connected: false })
  }

  const stripe = getStripe()
  if (!stripe) {
    // Return cached DB state if Stripe is unavailable
    return NextResponse.json({ connected: true, account })
  }

  try {
    const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id)

    const status = stripeAccount.payouts_enabled
      ? "ACTIVE"
      : stripeAccount.details_submitted
      ? "RESTRICTED"
      : "PENDING"

    const updates = {
      payouts_enabled: stripeAccount.payouts_enabled,
      charges_enabled: stripeAccount.charges_enabled,
      details_submitted: stripeAccount.details_submitted,
      account_status: status as "ACTIVE" | "RESTRICTED" | "PENDING",
      updated_at: new Date().toISOString(),
    }

    await supabase
      .from("seller_stripe_accounts")
      .update(updates)
      .eq("id", account.id)

    return NextResponse.json({
      connected: true,
      account: { ...account, ...updates },
      requirements: stripeAccount.requirements,
    })
  } catch (err) {
    console.error("[connect/account-status] Stripe error:", err)
    return NextResponse.json({ connected: true, account })
  }
}
