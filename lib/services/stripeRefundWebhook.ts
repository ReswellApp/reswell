import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe-server"
import { relistAfterRefund } from "@/lib/services/listingRelist"
import { splitSellerRefundClawback } from "@/lib/split-seller-refund-clawback"

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

type OrderRefundSyncRow = {
  id: string
  seller_earnings: string | number | null
}

/**
 * Persist buyer-visible order status and payout rows from Stripe refund totals.
 * Safe to call when seller earnings are missing or clawback rounds to zero — those cases previously
 * exited early and left `orders.status` stuck on `confirmed` after a full refund.
 *
 * @returns `true` when the order transitioned to fully refunded.
 */
async function syncOrderAndPayoutsFromStripeRefundState(
  supabase: SupabaseClient,
  order: OrderRefundSyncRow,
  pi: Stripe.PaymentIntent,
  refundsList: Stripe.ApiList<Stripe.Refund>,
): Promise<boolean> {
  const totalRefundedCents = refundsList.data
    .filter((r) => r.status === "succeeded")
    .reduce((sum, r) => sum + r.amount, 0)
  const isFullyRefunded = totalRefundedCents >= pi.amount

  const sellerEarningsNum = Number(order.seller_earnings)
  const sellerCents =
    Number.isFinite(sellerEarningsNum) && sellerEarningsNum > 0
      ? Math.round(sellerEarningsNum * 100)
      : 0

  const remainingSellerCents =
    sellerCents > 0
      ? Math.round((sellerCents * Math.max(0, pi.amount - totalRefundedCents)) / pi.amount)
      : 0
  const remainingSellerShare = roundMoney(remainingSellerCents / 100)

  const nowIso = new Date().toISOString()

  if (isFullyRefunded) {
    const { error: orderErr } = await supabase
      .from("orders")
      .update({ status: "refunded", refunded_at: nowIso, updated_at: nowIso })
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
  } else if (sellerCents > 0) {
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

  return isFullyRefunded
}

/**
 * Reconcile `orders` / `payouts` / **wallet** (and re-list when fully refunded) from Stripe's current
 * refund totals. Use when a new Stripe refund cannot be created because the charge was already refunded
 * (e.g. Dashboard refund, duplicate seller click) but Supabase was never updated.
 *
 * Iterates all succeeded refunds and creates any missing wallet clawback rows (idempotent via the
 * unique index `wallet_transactions_stripe_refund_uidx`).
 */
export async function syncMarketplaceOrderFromStripePaymentIntent(
  supabase: SupabaseClient,
  paymentIntentId: string,
): Promise<
  | { ok: true; orderId: string; fullyRefunded: boolean }
  | { ok: false; reason: "order_not_found" }
  | { ok: false; reason: "stripe_error"; message: string }
> {
  const stripe = getStripe()
  let pi: Stripe.PaymentIntent
  try {
    pi = await stripe.paymentIntents.retrieve(paymentIntentId)
  } catch (e) {
    return {
      ok: false,
      reason: "stripe_error",
      message: e instanceof Error ? e.message : String(e),
    }
  }

  let refundsList: Stripe.ApiList<Stripe.Refund>
  try {
    refundsList = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 })
  } catch (e) {
    return {
      ok: false,
      reason: "stripe_error",
      message: e instanceof Error ? e.message : String(e),
    }
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, seller_id, seller_earnings, listing_id, amount")
    .eq("stripe_checkout_session_id", paymentIntentId)
    .eq("payment_method", "stripe")
    .maybeSingle()

  if (!order) {
    return { ok: false, reason: "order_not_found" }
  }

  const fullyRefunded = await syncOrderAndPayoutsFromStripeRefundState(
    supabase,
    { id: order.id, seller_earnings: order.seller_earnings },
    pi,
    refundsList,
  )

  // Reconcile seller wallet for each succeeded refund that has no wallet tx yet
  const sellerEarnings = Number(order.seller_earnings)
  if (Number.isFinite(sellerEarnings) && sellerEarnings > 0 && pi.amount > 0) {
    await reconcileWalletForMissingRefunds(supabase, {
      orderId: order.id,
      sellerId: order.seller_id,
      listingId: order.listing_id,
      sellerEarnings,
      piAmountCents: pi.amount,
      orderTotalUsd: Number(order.amount),
      succeededRefunds: refundsList.data.filter((r) => r.status === "succeeded"),
    })
  }

  if (fullyRefunded && order.listing_id) {
    await relistAfterRefund(supabase, order.listing_id)
  }

  return { ok: true, orderId: order.id, fullyRefunded }
}

/**
 * For each succeeded Stripe refund without a matching `wallet_transactions` row, create the seller
 * clawback entry. Relies on the unique index for idempotency if a webhook fires concurrently.
 */
async function reconcileWalletForMissingRefunds(
  supabase: SupabaseClient,
  opts: {
    orderId: string
    sellerId: string
    listingId: string
    sellerEarnings: number
    piAmountCents: number
    orderTotalUsd: number
    succeededRefunds: Stripe.Refund[]
  },
): Promise<void> {
  if (opts.succeededRefunds.length === 0) return

  const refundIds = opts.succeededRefunds.map((r) => r.id)
  const { data: existingRows } = await supabase
    .from("wallet_transactions")
    .select("reference_id")
    .eq("reference_type", "stripe_refund")
    .in("reference_id", refundIds)

  const existing = new Set((existingRows ?? []).map((r) => r.reference_id as string))
  const missing = opts.succeededRefunds.filter((r) => !existing.has(r.id))
  if (missing.length === 0) return

  const { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", opts.sellerId)
    .maybeSingle()

  if (!wallet) {
    console.error("[sync refund] seller wallet not found", { seller: opts.sellerId })
    return
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("title")
    .eq("id", opts.listingId)
    .maybeSingle()
  const title = typeof listing?.title === "string" ? listing.title : "Listing"

  let curBalance = parseFloat(String(wallet.balance ?? 0))
  let curPending = parseFloat(
    String((wallet as { pending_balance?: string | number | null }).pending_balance ?? 0),
  )
  let curEarned = parseFloat(String(wallet.lifetime_earned ?? 0))

  const sellerCents = Math.round(opts.sellerEarnings * 100)

  for (const refund of missing) {
    const clawbackCents = Math.round((sellerCents * refund.amount) / opts.piAmountCents)
    const clawbackUsd = roundMoney(clawbackCents / 100)
    if (clawbackUsd <= 0) continue

    const refundUsd = refund.amount / 100
    const partialNote =
      refund.amount < opts.piAmountCents
        ? `partial refund $${refundUsd.toFixed(2)} of $${opts.orderTotalUsd.toFixed(2)} card total`
        : `full refund $${refundUsd.toFixed(2)} (card total $${opts.orderTotalUsd.toFixed(2)})`

    const split = splitSellerRefundClawback(clawbackUsd, curPending, curBalance)
    if (split.totalClawed <= 0) continue

    const bucketNote =
      split.clawFromPending > 0 && split.clawFromBalance > 0
        ? `pending $${split.clawFromPending.toFixed(2)}; available $${split.clawFromBalance.toFixed(2)}`
        : split.clawFromPending > 0
          ? "pending earnings"
          : "available balance"

    const newEarned = roundMoney(
      Math.max(0, curEarned - split.clawFromPending - split.clawFromBalance),
    )

    const { error: txErr } = await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      user_id: opts.sellerId,
      type: "refund",
      amount: -split.totalClawed,
      balance_after: split.newBalance.toFixed(2),
      description: `Refund — "${title}" (${partialNote}; ${bucketNote}; Stripe ${refund.id})`,
      status: "completed",
      reference_id: refund.id,
      reference_type: "stripe_refund",
    })

    if (txErr) {
      if ((txErr as { code?: string }).code === "23505") continue
      console.error("[sync refund] wallet tx insert", txErr)
      continue
    }
    curPending = split.newPending
    curBalance = split.newBalance
    curEarned = newEarned
  }

  await supabase
    .from("wallets")
    .update({
      balance: curBalance.toFixed(2),
      pending_balance: curPending.toFixed(2),
      lifetime_earned: curEarned.toFixed(2),
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallet.id)
}

/**
 * When Stripe refunds a card payment, reverse the seller's proportional share from `pending_balance`
 * first, then spendable `balance` (same allocation as admin-initiated refunds). Idempotent per Stripe
 * refund id (`re_…`).
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

  const { data: existingTx } = await supabase
    .from("wallet_transactions")
    .select("id")
    .eq("reference_type", "stripe_refund")
    .eq("reference_id", refund.id)
    .maybeSingle()

  if (existingTx) {
    const wasFullRefund = await syncOrderAndPayoutsFromStripeRefundState(supabase, order, pi, refundsList)
    if (wasFullRefund) {
      await relistAfterRefund(supabase, order.listing_id)
    }
    return
  }

  const sellerEarnings = Number(order.seller_earnings)
  if (!Number.isFinite(sellerEarnings) || sellerEarnings <= 0) {
    console.warn("[stripe refund webhook] zero/invalid seller_earnings — syncing order status only", { orderId: order.id })
    const wasFullRefund = await syncOrderAndPayoutsFromStripeRefundState(supabase, order, pi, refundsList)
    if (wasFullRefund) {
      await relistAfterRefund(supabase, order.listing_id)
    }
    return
  }

  const sellerCents = Math.round(sellerEarnings * 100)
  const clawbackCents = Math.round((sellerCents * refund.amount) / pi.amount)
  const clawbackUsd = roundMoney(clawbackCents / 100)

  if (clawbackUsd <= 0) {
    console.warn("[stripe refund webhook] zero clawback — syncing order status only", { refund: refund.id, orderId: order.id })
    const wasFullRefund = await syncOrderAndPayoutsFromStripeRefundState(supabase, order, pi, refundsList)
    if (wasFullRefund) {
      await relistAfterRefund(supabase, order.listing_id)
    }
    return
  }

  const wasFullRefund = await syncOrderAndPayoutsFromStripeRefundState(supabase, order, pi, refundsList)

  let { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", order.seller_id)
    .maybeSingle()

  if (!wallet) {
    const { data: insertedWallet, error: walletInsertErr } = await supabase
      .from("wallets")
      .insert({ user_id: order.seller_id })
      .select()
      .single()
    if (walletInsertErr || !insertedWallet) {
      console.error("[stripe refund webhook] seller wallet missing", { seller: order.seller_id })
      return
    }
    wallet = insertedWallet
  }

  const prevBalance = Number.parseFloat(String(wallet.balance))
  const prevPending = Number.parseFloat(
    String((wallet as { pending_balance?: string | number | null }).pending_balance ?? 0),
  )
  const prevEarned = Number.parseFloat(String(wallet.lifetime_earned))

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

  const split = splitSellerRefundClawback(clawbackUsd, prevPending, prevBalance)
  if (split.totalClawed <= 0) {
    if (wasFullRefund) {
      await relistAfterRefund(supabase, order.listing_id)
    }
    return
  }

  const bucketNote =
    split.clawFromPending > 0 && split.clawFromBalance > 0
      ? `pending $${split.clawFromPending.toFixed(2)}; available $${split.clawFromBalance.toFixed(2)}`
      : split.clawFromPending > 0
        ? "pending earnings"
        : "available balance"

  const newLifetimeEarned = roundMoney(
    Math.max(0, prevEarned - split.clawFromPending - split.clawFromBalance),
  )

  const { error: txErr } = await supabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: order.seller_id,
    type: "refund",
    amount: -split.totalClawed,
    balance_after: split.newBalance.toFixed(2),
    description: `Refund — "${title}" (${partialNote}; ${bucketNote}; Stripe ${refund.id})`,
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
      balance: split.newBalance.toFixed(2),
      pending_balance: split.newPending.toFixed(2),
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

  if (wasFullRefund) {
    await relistAfterRefund(supabase, order.listing_id)
  }
}

/**
 * When Stripe creates a refund (e.g. Dashboard) it is often `pending` before `succeeded`.
 * Surface `refunding` in-app immediately; wallet clawback and full reconciliation run on success.
 */
export async function markMarketplaceOrderRefundingFromStripeRefund(refund: Stripe.Refund): Promise<void> {
  if (refund.status !== "pending" && refund.status !== "requires_action") {
    return
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("[stripe refund webhook] service client (mark refunding)", e)
    return
  }

  const stripe = getStripe()
  const piId = await resolvePaymentIntentId(refund, stripe)
  if (!piId) {
    console.warn("[stripe refund webhook] could not resolve payment_intent (mark refunding)", {
      refund: refund.id,
    })
    return
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("stripe_checkout_session_id", piId)
    .eq("payment_method", "stripe")
    .maybeSingle()

  if (!order || order.status === "refunded") {
    return
  }
  if (order.status !== "confirmed" && order.status !== "refunding") {
    return
  }

  const nowIso = new Date().toISOString()
  const { error: updErr } = await supabase
    .from("orders")
    .update({ status: "refunding", updated_at: nowIso })
    .eq("id", order.id)
    .in("status", ["confirmed", "refunding"])

  if (updErr) {
    console.error("[stripe refund webhook] mark refunding status", updErr)
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

  if (refund.status === "succeeded") {
    try {
      await applyMarketplaceStripeRefund(refund)
    } catch (e) {
      console.error("[stripe refund webhook] applyMarketplaceStripeRefund", e)
    }
    return true
  }

  if (refund.status === "pending" || refund.status === "requires_action") {
    try {
      await markMarketplaceOrderRefundingFromStripeRefund(refund)
    } catch (e) {
      console.error("[stripe refund webhook] markMarketplaceOrderRefundingFromStripeRefund", e)
    }
    return true
  }

  return true
}
