import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe-server"
import type Stripe from "stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function buffer(req: NextRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  const reader = req.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  const sig = req.headers.get("stripe-signature")
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const rawBody = await buffer(req)
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[stripe-webhook] Signature verification failed:", msg)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "charge.refunded") {
    await handleChargeRefunded(event.data.object as Stripe.Charge)
  }

  return NextResponse.json({ received: true })
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const piId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id

  if (!piId) {
    console.error("[stripe-webhook] charge.refunded: no payment_intent id")
    return
  }

  const supabase = createServiceRoleClient()

  const { data: order } = await supabase
    .from("orders")
    .select("id, seller_id, seller_earnings, status, listing_id")
    .eq("stripe_checkout_session_id", piId)
    .maybeSingle()

  if (!order) {
    console.warn("[stripe-webhook] charge.refunded: no order for PI", piId)
    return
  }

  if (order.status === "refunded") {
    console.log("[stripe-webhook] charge.refunded: order already refunded", order.id)
    return
  }

  const now = new Date().toISOString()
  const earnings = parseFloat(String(order.seller_earnings))

  const { error: orderErr } = await supabase
    .from("orders")
    .update({ status: "refunded", updated_at: now })
    .eq("id", order.id)

  if (orderErr) {
    console.error("[stripe-webhook] order update failed:", orderErr)
    return
  }

  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, balance")
    .eq("user_id", order.seller_id)
    .maybeSingle()

  if (wallet && Number.isFinite(earnings) && earnings > 0) {
    const newBalance = Math.max(0, parseFloat(String(wallet.balance)) - earnings)

    await supabase
      .from("wallets")
      .update({ balance: newBalance, updated_at: now })
      .eq("id", wallet.id)

    await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      user_id: order.seller_id,
      type: "refund",
      amount: -earnings,
      balance_after: newBalance,
      description: `Refund — order #${order.id.slice(0, 8)} reversed`,
      reference_id: order.id,
      reference_type: "order",
    })
  }

  await supabase
    .from("payouts")
    .update({ status: "cancelled", hold_reason: null, updated_at: now })
    .eq("order_id", order.id)
    .in("status", ["held", "pending"])

  await supabase
    .from("listings")
    .update({ status: "active", updated_at: now })
    .eq("id", order.listing_id)

  console.log("[stripe-webhook] charge.refunded: processed order", order.id)
}
