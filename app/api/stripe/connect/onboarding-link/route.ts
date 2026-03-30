import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe-server"
import { STRIPE_CONNECT_GENERIC_ERROR } from "@/lib/stripe-connect-user-messages"

export const runtime = "nodejs"

export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const stripe = getStripe()
  if (!stripe) {
    console.error("[connect/onboarding-link] STRIPE_SECRET_KEY missing or invalid")
    return NextResponse.json({ error: STRIPE_CONNECT_GENERIC_ERROR }, { status: 503 })
  }

  const { data: account } = await supabase
    .from("seller_stripe_accounts")
    .select("stripe_account_id")
    .eq("user_id", user.id)
    .single()

  if (!account) {
    return NextResponse.json({ error: "No Stripe account found. Create one first." }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"

  try {
    const accountLink = await stripe.accountLinks.create({
      account: account.stripe_account_id,
      refresh_url: `${baseUrl}/dashboard/payouts?setup=refresh`,
      return_url: `${baseUrl}/dashboard/payouts?setup=complete`,
      type: "account_onboarding",
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error) {
    console.error("[connect/onboarding-link] Stripe Connect error:", error)
    return NextResponse.json({ error: STRIPE_CONNECT_GENERIC_ERROR }, { status: 500 })
  }
}
