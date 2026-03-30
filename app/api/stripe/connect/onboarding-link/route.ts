import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripeOptional } from "@/lib/stripe-client"
import { STRIPE_CONNECT_GENERIC_ERROR } from "@/lib/stripe-connect-user-messages"
import Stripe from "stripe"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
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

  let body: { accountId?: string } = {}
  try {
    body = await request.json()
  } catch {
    /* optional body */
  }

  const { data: row } = await supabase
    .from("seller_stripe_accounts")
    .select("stripe_account_id")
    .eq("user_id", user.id)
    .single()

  if (!row) {
    return NextResponse.json({ error: "No Stripe account found. Create one first." }, { status: 400 })
  }

  const requestedId = body.accountId?.trim()
  if (requestedId && requestedId !== row.stripe_account_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const accountId = requestedId || row.stripe_account_id
  const baseUrl = (process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/, "")

  console.log("[connect/onboarding-link] Creating onboarding link for account:", accountId)
  console.log("[connect/onboarding-link] NEXT_PUBLIC_URL:", process.env.NEXT_PUBLIC_URL)

  const useCase: Stripe.V2.Core.AccountLinkCreateParams.UseCase = {
    type: "account_onboarding",
    account_onboarding: {
      configurations: ["recipient"],
      refresh_url: `${baseUrl}/seller/payouts?setup=refresh`,
      return_url: `${baseUrl}/seller/payouts?setup=complete&accountId=${encodeURIComponent(accountId)}`,
    },
  }

  try {
    const accountLink = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: useCase,
    })

    console.log("[connect/onboarding-link] Onboarding link created:", accountLink.url)
    return NextResponse.json({ url: accountLink.url })
  } catch (error: unknown) {
    const stripeErr = error instanceof Stripe.errors.StripeError ? error : null
    const anyErr = error as {
      message?: string
      type?: string
      code?: string
      statusCode?: number
      param?: string
      raw?: unknown
    }

    console.error("[connect/onboarding-link] Onboarding link full error:", {
      message: stripeErr?.message ?? anyErr.message,
      type: stripeErr?.type ?? anyErr.type,
      code: stripeErr?.code ?? anyErr.code,
      statusCode: stripeErr?.statusCode ?? anyErr.statusCode,
      param: stripeErr instanceof Stripe.errors.StripeInvalidRequestError ? stripeErr.param : anyErr.param,
      raw: stripeErr?.raw ?? anyErr.raw,
    })

    return NextResponse.json(
      {
        error: stripeErr?.message ?? anyErr.message ?? "Onboarding link failed",
        type: stripeErr?.type ?? anyErr.type,
        code: stripeErr?.code ?? anyErr.code,
        param:
          stripeErr instanceof Stripe.errors.StripeInvalidRequestError
            ? stripeErr.param
            : anyErr.param,
      },
      { status: 500 }
    )
  }
}
