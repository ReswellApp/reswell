import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getPublicAppOrigin,
  originIsLocalhost,
  stripeSecretKeyIsLiveMode,
} from "@/lib/checkout-app-origin"
import { stripeContextForConnectedAccount } from "@/lib/stripe-connect-context"
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
  const baseUrl = getPublicAppOrigin()

  console.log("[connect/onboarding-link] Creating onboarding link for account:", accountId)
  console.log("[connect/onboarding-link] Resolved redirect base URL:", baseUrl)
  console.log("[connect/onboarding-link] NEXT_PUBLIC_URL:", process.env.NEXT_PUBLIC_URL)
  console.log("[connect/onboarding-link] NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL)

  if (stripeSecretKeyIsLiveMode() && originIsLocalhost(baseUrl)) {
    console.error(
      "[connect/onboarding-link] sk_live with localhost-style origin (not allowed by Stripe):",
      baseUrl
    )
    return NextResponse.json(
      {
        error:
          "Stripe live mode requires HTTPS return URLs on a public domain, not localhost. Set NEXT_PUBLIC_URL (or NEXT_PUBLIC_APP_URL) to your site, e.g. https://reswellsurf.com. For local testing, use test keys (sk_test_… / pk_test_…).",
        code: "connect_localhost_with_live_key",
      },
      { status: 400 }
    )
  }

  const refreshUrl = `${baseUrl}/seller/payouts?setup=refresh`
  const returnUrl = `${baseUrl}/seller/payouts?setup=complete&accountId=${encodeURIComponent(accountId)}`

  try {
    new URL(refreshUrl)
    new URL(returnUrl)
  } catch {
    console.error("[connect/onboarding-link] Invalid redirect URLs built from base:", baseUrl)
    return NextResponse.json(
      {
        error:
          "Invalid app URL for Stripe redirects. Set NEXT_PUBLIC_URL or NEXT_PUBLIC_APP_URL to a full URL with scheme (https://yourdomain.com).",
        code: "invalid_redirect_origin",
      },
      { status: 400 }
    )
  }

  const useCase: Stripe.V2.Core.AccountLinkCreateParams.UseCase = {
    type: "account_onboarding",
    account_onboarding: {
      configurations: ["recipient"],
      refresh_url: refreshUrl,
      return_url: returnUrl,
    },
  }

  try {
    const accountLink = await stripe.v2.core.accountLinks.create(
      {
        account: accountId,
        use_case: useCase,
      },
      stripeContextForConnectedAccount(accountId)
    )

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
