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
    console.error("[connect/create-account] STRIPE_SECRET_KEY missing or invalid")
    return NextResponse.json({ error: STRIPE_CONNECT_GENERIC_ERROR }, { status: 503 })
  }

  // Check if already has a Connect account
  const { data: existing } = await supabase
    .from("seller_stripe_accounts")
    .select("stripe_account_id, account_status")
    .eq("user_id", user.id)
    .single()

  if (existing) {
    return NextResponse.json({
      stripe_account_id: existing.stripe_account_id,
      account_status: existing.account_status,
      already_exists: true,
    })
  }

  // Get seller email and name from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, username")
    .eq("id", user.id)
    .single()

  try {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: user.email,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      business_type: "individual",
      metadata: {
        reswell_user_id: user.id,
        reswell_username: profile?.username ?? "",
      },
      settings: {
        payouts: {
          schedule: {
            interval: "manual",
          },
        },
      },
    })

    const { error: insertError } = await supabase
      .from("seller_stripe_accounts")
      .insert({
        user_id: user.id,
        stripe_account_id: account.id,
        account_status: "PENDING",
        payouts_enabled: account.payouts_enabled,
        charges_enabled: account.charges_enabled,
        details_submitted: account.details_submitted,
      })

    if (insertError) {
      console.error("[connect/create-account] DB insert failed:", insertError)
      // Clean up Stripe account if DB insert fails
      await stripe.accounts.del(account.id).catch(() => null)
      return NextResponse.json({ error: STRIPE_CONNECT_GENERIC_ERROR }, { status: 500 })
    }

    // Ensure seller_balances row exists
    const { error: rpcError } = await supabase.rpc("ensure_seller_balance", {
      p_user_id: user.id,
    })
    if (rpcError) {
      console.error("[connect/create-account] ensure_seller_balance failed:", rpcError)
    }

    return NextResponse.json({ stripe_account_id: account.id })
  } catch (error) {
    // Never expose raw Stripe errors to the client (may mention keys, permissions, internal IDs)
    console.error("[connect/create-account] Stripe Connect error:", error)
    return NextResponse.json({ error: STRIPE_CONNECT_GENERIC_ERROR }, { status: 500 })
  }
}
