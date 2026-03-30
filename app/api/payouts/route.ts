import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe-server"
import { headers } from "next/headers"

export const runtime = "nodejs"

const INSTANT_FEE_PERCENT = 1.5
const INSTANT_FEE_MIN = 0.5

// ─── GET: balance + payout history + payment methods ────────────────────────

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [balanceResult, payoutsResult, methodsResult, accountResult] = await Promise.all([
    supabase
      .from("seller_balances")
      .select("*")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("payouts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("seller_payment_methods")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false }),
    supabase
      .from("seller_stripe_accounts")
      .select("*")
      .eq("user_id", user.id)
      .single(),
  ])

  return NextResponse.json({
    balance: balanceResult.data ?? {
      available_balance: 0,
      pending_balance: 0,
      reswell_credit: 0,
      lifetime_earned: 0,
      lifetime_paid_out: 0,
    },
    payouts: payoutsResult.data ?? [],
    paymentMethods: methodsResult.data ?? [],
    stripeAccount: accountResult.data ?? null,
  })
}

// ─── POST: request a payout ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for") ?? headersList.get("x-real-ip") ?? "unknown"

  const body = await request.json()
  const { amount, method, payment_method_id } = body as {
    amount: number
    method: "ACH" | "INSTANT" | "PAYPAL" | "RESWELL_CREDIT"
    payment_method_id?: string
  }

  if (!amount || !method) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Minimums
  const MINIMUMS: Record<string, number> = { ACH: 10, INSTANT: 1, PAYPAL: 10, RESWELL_CREDIT: 0.01 }
  if (amount < MINIMUMS[method]) {
    return NextResponse.json(
      { error: `Minimum payout for ${method} is $${MINIMUMS[method].toFixed(2)}` },
      { status: 400 }
    )
  }

  // Load seller balance
  const { data: balance } = await supabase
    .from("seller_balances")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!balance) {
    return NextResponse.json({ error: "No balance account found" }, { status: 400 })
  }

  const available = parseFloat(balance.available_balance)

  if (method !== "RESWELL_CREDIT" && amount > available) {
    return NextResponse.json(
      { error: "Insufficient available balance", available },
      { status: 400 }
    )
  }

  // Compute fee
  let fee = 0
  if (method === "INSTANT") {
    fee = Math.max(INSTANT_FEE_MIN, Math.round(amount * INSTANT_FEE_PERCENT) / 100)
  }
  const netAmount = Math.round((amount - fee) * 100) / 100

  // For real payouts, load Stripe account
  let stripeAccount: { stripe_account_id: string } | null = null
  if (method === "ACH" || method === "INSTANT") {
    const { data: sa } = await supabase
      .from("seller_stripe_accounts")
      .select("stripe_account_id, payouts_enabled")
      .eq("user_id", user.id)
      .single()

    if (!sa || !sa.payouts_enabled) {
      return NextResponse.json(
        { error: "Stripe payouts are not enabled for your account. Complete payout setup first." },
        { status: 400 }
      )
    }
    stripeAccount = sa
  }

  // Load payment method details for destination label
  let destination = "Reswell credit"
  let paymentMethodRecord: Record<string, unknown> | null = null
  if (payment_method_id && method !== "RESWELL_CREDIT") {
    const { data: pm } = await supabase
      .from("seller_payment_methods")
      .select("*")
      .eq("id", payment_method_id)
      .eq("user_id", user.id)
      .single()

    if (!pm) {
      return NextResponse.json({ error: "Payment method not found" }, { status: 400 })
    }
    paymentMethodRecord = pm as Record<string, unknown>

    if (pm.type === "BANK_ACCOUNT") {
      destination = `${pm.bank_name ?? "Bank"} ••••${pm.account_last4}`
    } else if (pm.type === "DEBIT_CARD") {
      destination = `${pm.card_brand ?? "Card"} ••••${pm.card_last4}`
    } else if (pm.type === "PAYPAL") {
      destination = pm.paypal_email as string
    }
  }

  // Security flag: new method + immediate payout
  if (paymentMethodRecord) {
    const createdAt = new Date(paymentMethodRecord.created_at as string).getTime()
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    if (createdAt > oneHourAgo) {
      console.warn(`[payouts] Possible fraud: payout to method added <1hr ago. user=${user.id}`)
    }
  }

  // Create the payout record
  const amountInCents = Math.round(amount * 100)
  let stripePayout: { id: string } | null = null
  let estimatedArrival: Date | null = null
  let failureReason: string | null = null
  let status: "PENDING" | "IN_TRANSIT" | "PAID" | "FAILED" = "PENDING"

  const stripe = getStripe()

  try {
    if (method === "ACH" && stripeAccount && stripe) {
      const sp = await stripe.payouts.create(
        {
          amount: amountInCents,
          currency: "usd",
          method: "standard",
          statement_descriptor: "RESWELL PAYOUT",
        },
        { stripeAccount: stripeAccount.stripe_account_id }
      )
      stripePayout = sp
      status = "IN_TRANSIT"
      // Standard ACH: 2-5 business days
      const arrival = new Date()
      arrival.setDate(arrival.getDate() + 3)
      estimatedArrival = arrival
    } else if (method === "INSTANT" && stripeAccount && stripe) {
      const pm = paymentMethodRecord as Record<string, unknown>
      const sp = await stripe.payouts.create(
        {
          amount: amountInCents,
          currency: "usd",
          method: "instant",
          ...(pm?.stripe_pm_id ? { destination: pm.stripe_pm_id as string } : {}),
        },
        { stripeAccount: stripeAccount.stripe_account_id }
      )
      stripePayout = sp
      status = "IN_TRANSIT"
      const arrival = new Date()
      arrival.setMinutes(arrival.getMinutes() + 30)
      estimatedArrival = arrival
    } else if (method === "PAYPAL") {
      // PayPal payout — mark as pending for manual processing
      // In production: call PayPal Payouts API here
      status = "PENDING"
      const arrival = new Date()
      arrival.setDate(arrival.getDate() + 2)
      estimatedArrival = arrival
    } else if (method === "RESWELL_CREDIT") {
      status = "PAID"
    }
  } catch (err) {
    const stripeErr = err as { message?: string }
    console.error("[payouts] Stripe payout error:", stripeErr)
    failureReason = stripeErr.message ?? "Payout failed"
    status = "FAILED"
  }

  // Deduct from available_balance (or add to reswell_credit)
  const newAvailable = method === "RESWELL_CREDIT" ? available : available - amount
  const newReswellCredit =
    method === "RESWELL_CREDIT"
      ? parseFloat(balance.reswell_credit) + netAmount
      : parseFloat(balance.reswell_credit)

  await supabase
    .from("seller_balances")
    .update({
      available_balance: status === "FAILED" ? available : newAvailable,
      reswell_credit: newReswellCredit,
      lifetime_paid_out:
        status !== "FAILED"
          ? parseFloat(balance.lifetime_paid_out) + netAmount
          : parseFloat(balance.lifetime_paid_out),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)

  // Insert payout record
  const { data: payoutRecord } = await supabase
    .from("payouts")
    .insert({
      user_id: user.id,
      amount,
      fee,
      net_amount: netAmount,
      method,
      status,
      stripe_payout_id: stripePayout?.id ?? null,
      destination,
      estimated_arrival: estimatedArrival?.toISOString() ?? null,
      failure_reason: failureReason,
      ip_address: ip,
    })
    .select()
    .single()

  // Audit log
  await supabase.from("payout_security_log").insert({
    user_id: user.id,
    action: "payout_requested",
    details: { amount, method, destination, status, payout_id: payoutRecord?.id },
    ip_address: ip,
  })

  if (status === "FAILED") {
    return NextResponse.json(
      { error: failureReason ?? "Payout failed", payout: payoutRecord },
      { status: 422 }
    )
  }

  return NextResponse.json({ success: true, payout: payoutRecord, netAmount, fee })
}
