import type Stripe from "stripe"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe-server"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const e = err as { code?: string; message?: string }
  if (e.code === "23505") return true
  return typeof e.message === "string" && e.message.toLowerCase().includes("duplicate")
}

async function resolvePaymentIntentId(
  refund: Stripe.Refund,
  stripe: Stripe,
): Promise<string | null> {
  const pi = refund.payment_intent
  if (typeof pi === "string" && pi.startsWith("pi_")) {
    return pi
  }
  if (pi && typeof pi === "object" && "id" in pi && typeof pi.id === "string") {
    return pi.id
  }
  const ch = refund.charge
  const chargeId = typeof ch === "string" ? ch : ch && typeof ch === "object" && "id" in ch ? ch.id : null
  if (!chargeId) {
    return null
  }
  const charge = await stripe.charges.retrieve(chargeId)
  const cpi = charge.payment_intent
  if (typeof cpi === "string") {
    return cpi
  }
  if (cpi && typeof cpi === "object" && "id" in cpi && typeof cpi.id === "string") {
    return cpi.id
  }
  return null
}

/**
 * When Stripe refunds a card payment, reverse the seller’s proportional share of earnings in the wallet
 * and keep orders / payouts aligned. Idempotent per Stripe refund id (`re_…`).
 */
export async function applyMarketplaceStripeRefund(refund: Stripe.Refund): Promise<void> {
  if (refund.status !== "succeeded") {
    return
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("[stripe refund webhook] service client", e)
    return
  }

  const stripe = getStripe()

  const { data: existingTx } = await supabase
    .from("wallet_transactions")
    .select("id")
    .eq("reference_type", "stripe_refund")
    .eq("reference_id", refund.id)
    .maybeSingle()

  if (existingTx) {
    return
  }

  const piId = await resolvePaymentIntentId(refund, stripe)
  if (!piId) {
    console.warn("[stripe refund webhook] could not resolve payment_intent", { refund: refund.id })
    return
  }

  const pi = await stripe.paymentIntents.retrieve(piId)
  if (!pi.amount || pi.amount <= 0) {
    console.error("[stripe refund webhook] invalid PaymentIntent amount", { piId })
    return
  }

  const refundsList = await stripe.refunds.list({ payment_intent: piId, limit: 100 })

  const { data: order } = await supabase
    .from("orders")
    .select("id, seller_id, amount, seller_earnings, status, listing_id")
    .eq("stripe_checkout_session_id", piId)
    .eq("payment_method", "stripe")
    .maybeSingle()

  if (!order) {
    return
  }

  const sellerEarnings = Number(order.seller_earnings)
  if (!Number.isFinite(sellerEarnings) || sellerEarnings <= 0) {
    console.error("[stripe refund webhook] invalid seller_earnings", { orderId: order.id })
    return
  }

  const sellerCents = Math.round(sellerEarnings * 100)
  const clawbackCents = Math.round((sellerCents * refund.amount) / pi.amount)
  const clawbackUsd = roundMoney(clawbackCents / 100)

  if (clawbackUsd <= 0) {
    console.warn("[stripe refund webhook] zero clawback skipped", { refund: refund.id, orderId: order.id })
    return
  }

  const { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", order.seller_id)
    .maybeSingle()

  if (!wallet) {
    console.error("[stripe refund webhook] seller wallet missing", { seller: order.seller_id })
    return
  }

  const prevBalance = Number.parseFloat(String(wallet.balance))
  const prevEarned = Number.parseFloat(String(wallet.lifetime_earned))
  const newBalance = roundMoney(prevBalance - clawbackUsd)
  const newLifetimeEarned = roundMoney(prevEarned - clawbackUsd)

  const { data: listing } = await supabase
    .from("listings")
    .select("title")
    .eq("id", order.listing_id)
    .maybeSingle()

  const title = typeof listing?.title === "string" ? listing.title : "Listing"
  const orderTotalUsd = pi.amount / 100
  const refundUsd = refund.amount / 100
  const partialNote =
    refund.amount < pi.amount
      ? `partial refund $${refundUsd.toFixed(2)} of $${orderTotalUsd.toFixed(2)} card total`
      : `full refund $${refundUsd.toFixed(2)} (card total $${orderTotalUsd.toFixed(2)})`

  const { error: txErr } = await supabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: order.seller_id,
    type: "refund",
    amount: -clawbackUsd,
    balance_after: newBalance,
    description: `Refund — "${title}" (${partialNote}, card; Stripe ${refund.id})`,
    status: "completed",
    reference_id: refund.id,
    reference_type: "stripe_refund",
  })

  if (txErr) {
    if (isUniqueViolation(txErr)) {
      return
    }
    console.error("[stripe refund webhook] wallet_transactions insert", txErr)
    return
  }

  const { error: walletErr } = await supabase
    .from("wallets")
    .update({
      balance: newBalance.toFixed(2),
      lifetime_earned: newLifetimeEarned.toFixed(2),
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallet.id)

  if (walletErr) {
    console.error("[stripe refund webhook] wallet update", walletErr)
    await supabase
      .from("wallet_transactions")
      .delete()
      .eq("reference_type", "stripe_refund")
      .eq("reference_id", refund.id)
    return
  }

  const totalRefundedCents = refundsList.data
    .filter((r) => r.status === "succeeded")
    .reduce((sum, r) => sum + r.amount, 0)
  const isFullyRefunded = totalRefundedCents >= pi.amount

  const remainingSellerCents = Math.round(
    (sellerCents * Math.max(0, pi.amount - totalRefundedCents)) / pi.amount,
  )
  const remainingSellerShare = roundMoney(remainingSellerCents / 100)

  const nowIso = new Date().toISOString()

  if (isFullyRefunded) {
    const { error: orderErr } = await supabase
      .from("orders")
      .update({ status: "refunded", updated_at: nowIso })
      .eq("id", order.id)
      .neq("status", "refunded")

    if (orderErr) {
      console.error("[stripe refund webhook] order status update", orderErr)
    }

    const { error: payoutCancelErr } = await supabase
      .from("payouts")
      .update({ status: "cancelled", updated_at: nowIso })
      .eq("order_id", order.id)

    if (payoutCancelErr) {
      console.error("[stripe refund webhook] payouts cancel", payoutCancelErr)
    }
  } else {
    const { error: payoutAdjErr } = await supabase
      .from("payouts")
      .update({
        amount: Math.max(0, remainingSellerShare),
        updated_at: nowIso,
      })
      .eq("order_id", order.id)
      .in("status", ["held", "pending"])

    if (payoutAdjErr) {
      console.error("[stripe refund webhook] payouts amount adjust", payoutAdjErr)
    }
  }
}

/**
 * @returns true if this event was a refund lifecycle event (consumed for webhook routing).
 */
export async function tryHandleStripeRefundEvent(event: Stripe.Event): Promise<boolean> {
  if (event.type !== "refund.created" && event.type !== "refund.updated") {
    return false
  }

  const refund = event.data.object as Stripe.Refund

  if (refund.status !== "succeeded") {
    return true
  }

  try {
    await applyMarketplaceStripeRefund(refund)
  } catch (e) {
    console.error("[stripe refund webhook] applyMarketplaceStripeRefund", e)
  }

  return true
}
