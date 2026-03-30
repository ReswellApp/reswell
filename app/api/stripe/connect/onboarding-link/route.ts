import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripeOptional } from "@/lib/stripe-client"
import { STRIPE_CONNECT_GENERIC_ERROR } from "@/lib/stripe-connect-user-messages"
import type Stripe from "stripe"

export const runtime = "nodejs"

export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const stripe = getStripeOptional()
  if (!stripe) {
    console.error("[connect/onboarding-link] STRIPE_SECRET_KEY missing or invalid")
    return NextResponse.json({ error: STRIPE_CONNECT_GENERIC_ERROR }, { status: 503 })
  }

  const { data: row } = await supabase
    .from("seller_stripe_accounts")
    .select("stripe_account_id")
    .eq("user_id", user.id)
    .single()

  if (!row) {
    return NextResponse.json({ error: "No Stripe account found. Create one first." }, { status: 400 })
  }

  const stripeAccountId = row.stripe_account_id
  const baseUrl = (process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/, "")
  const payoutsPath = "/dashboard/payouts"

  const useCase: Stripe.V2.Core.AccountLinkCreateParams.UseCase = {
    type: "account_onboarding",
    account_onboarding: {
      configurations: ["recipient"],
      refresh_url: `${baseUrl}${payoutsPath}?setup=refresh`,
      return_url: `${baseUrl}${payoutsPath}?setup=complete&accountId=${encodeURIComponent(stripeAccountId)}`,
    },
  }

  try {
    const accountLink = await stripe.v2.core.accountLinks.create({
      account: stripeAccountId,
      use_case: useCase,
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error) {
    console.error("[connect/onboarding-link] Stripe Connect error:", error)
    return NextResponse.json({ error: STRIPE_CONNECT_GENERIC_ERROR }, { status: 500 })
  }
}
