import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripeOptional } from "@/lib/stripe-client"
import { stripeContextForConnectedAccount } from "@/lib/stripe-connect-context"
import {
  persistSellerAccountFromV2Account,
  v2OnboardingComplete,
  v2RecipientTransfersActive,
  v2RequirementsSummaryStatus,
} from "@/lib/stripe-connect-v2-sync"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const paramId = request.nextUrl.searchParams.get("accountId")

  let stripeAccountId: string | null = paramId

  if (!stripeAccountId) {
    const { data: row } = await supabase
      .from("seller_stripe_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .single()
    stripeAccountId = row?.stripe_account_id ?? null
  }

  if (!stripeAccountId) {
    return NextResponse.json({ connected: false })
  }

  const { data: owned } = await supabase
    .from("seller_stripe_accounts")
    .select("id, user_id, stripe_account_id, account_status, payouts_enabled, charges_enabled, details_submitted")
    .eq("stripe_account_id", stripeAccountId)
    .eq("user_id", user.id)
    .single()

  if (!owned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const stripe = getStripeOptional()
  if (!stripe) {
    return NextResponse.json({
      connected: true,
      account: owned,
      readyToReceivePayments: owned.payouts_enabled,
      onboardingComplete: owned.details_submitted,
      requirementsStatus: undefined as string | undefined,
    })
  }

  try {
    const account = await stripe.v2.core.accounts.retrieve(
      stripeAccountId,
      {
        include: ["configuration.recipient", "requirements"],
      },
      stripeContextForConnectedAccount(stripeAccountId)
    )

    const readyToReceivePayments = v2RecipientTransfersActive(account)
    const requirementsStatus = v2RequirementsSummaryStatus(account)
    const onboardingComplete = v2OnboardingComplete(account)

    await persistSellerAccountFromV2Account(supabase, account)

    return NextResponse.json({
      connected: true,
      accountId: account.id,
      readyToReceivePayments,
      onboardingComplete,
      requirementsStatus,
      account: {
        ...owned,
        payouts_enabled: readyToReceivePayments,
        charges_enabled: readyToReceivePayments,
        details_submitted: onboardingComplete,
        account_status: readyToReceivePayments && onboardingComplete ? "ACTIVE" : "RESTRICTED",
      },
    })
  } catch (e) {
    console.error("[connect/account-status] Stripe V2 retrieve failed:", e)
    return NextResponse.json({
      connected: true,
      account: owned,
      readyToReceivePayments: owned.payouts_enabled,
      onboardingComplete: owned.details_submitted,
      requirementsStatus: undefined as string | undefined,
    })
  }
}
