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
    console.error("[connect/create-account] STRIPE_SECRET_KEY missing or invalid")
    return NextResponse.json({ error: STRIPE_CONNECT_GENERIC_ERROR }, { status: 503 })
  }

  const { data: existing } = await supabase
    .from("seller_stripe_accounts")
    .select("stripe_account_id, account_status")
    .eq("user_id", user.id)
    .single()

  if (existing) {
    return NextResponse.json({
      accountId: existing.stripe_account_id,
      stripe_account_id: existing.stripe_account_id,
      account_status: existing.account_status,
      already_exists: true,
    })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, username")
    .eq("id", user.id)
    .single()

  const displayName =
    (profile?.full_name?.trim() || profile?.username?.trim() || user.email?.split("@")[0] || "Seller")

  const createParams: Stripe.V2.Core.AccountCreateParams = {
    display_name: displayName,
    contact_email: user.email ?? undefined,
    identity: {
      country: "us",
    },
    dashboard: "express",
    defaults: {
      responsibilities: {
        fees_collector: "application",
        losses_collector: "application",
      },
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: {
              requested: true,
            },
          },
        },
      },
    },
    metadata: {
      reswell_user_id: user.id,
    },
  }

  let created: Stripe.Response<Stripe.V2.Core.Account> | null = null

  try {
    created = await stripe.v2.core.accounts.create(createParams)
  } catch (error) {
    console.error("[connect/create-account] Stripe Connect error:", error)
    return NextResponse.json({ error: STRIPE_CONNECT_GENERIC_ERROR }, { status: 500 })
  }

  const account = created!

  const { error: insertError } = await supabase.from("seller_stripe_accounts").insert({
    user_id: user.id,
    stripe_account_id: account.id,
    account_status: "PENDING",
    payouts_enabled: false,
    charges_enabled: false,
    details_submitted: false,
  })

  if (insertError) {
    console.error("[connect/create-account] DB insert failed:", insertError)
    await stripe.v2.core.accounts.close(account.id).catch((e) => {
      console.error("[connect/create-account] Failed to close orphaned V2 account:", e)
    })
    return NextResponse.json({ error: STRIPE_CONNECT_GENERIC_ERROR }, { status: 500 })
  }

  const { error: rpcError } = await supabase.rpc("ensure_seller_balance", {
    p_user_id: user.id,
  })
  if (rpcError) {
    console.error("[connect/create-account] ensure_seller_balance failed:", rpcError)
  }

  return NextResponse.json({
    accountId: account.id,
    stripe_account_id: account.id,
  })
}
