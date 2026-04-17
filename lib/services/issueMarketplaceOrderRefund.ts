import type { SupabaseClient } from "@supabase/supabase-js"
import Stripe from "stripe"
import { getStripe } from "@/lib/stripe-server"
import { applyWalletOrderRefund } from "@/lib/services/walletRefund"
import { relistAfterRefund } from "@/lib/services/listingRelist"
import { syncMarketplaceOrderFromStripePaymentIntent } from "@/lib/services/stripeRefundWebhook"
import { splitSellerRefundClawback } from "@/lib/split-seller-refund-clawback"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export type MarketplaceOrderRefundRow = {
  id: string
  seller_id: string
  buyer_id: string
  listing_id: string | null
  amount: number | string
  seller_earnings: string | number | null
  status: string
  payment_method: string | null
  stripe_checkout_session_id: string | null
}

export type IssueMarketplaceOrderRefundResult =
  | {
      ok: true
      refund_type: "stripe" | "wallet"
      message: string
      alreadyProcessedInStripe?: boolean
    }
  | { ok: false; error: string; status: number }

function isStripeChargeAlreadyRefundedError(err: unknown): boolean {
  if (err instanceof Stripe.errors.StripeInvalidRequestError) {
    if (err.code === "charge_already_refunded") return true
  }
  const msg = err instanceof Error ? err.message : String(err)
  return /already been refunded/i.test(msg)
}

/**
 * Full refund for a confirmed marketplace order (Stripe card or Reswell Bucks).
 *
 * Stripe card path:
 *   1. Create Stripe refund
 *   2. Mark order `refunded`, cancel payouts
 *   3. **Immediately** claw back seller wallet (pending_balance first, then balance)
 *   4. Re-list listing
 *   Idempotent via unique index on `(reference_type, reference_id) WHERE reference_type = 'stripe_refund'`.
 *   The later webhook (`refund.created`/`refund.updated`) detects the existing wallet tx and skips.
 *
 * Reswell Bucks path delegates to `applyWalletOrderRefund` which already claws back immediately.
 */
export async function issueMarketplaceOrderRefund(
  serviceSupabase: SupabaseClient,
  order: MarketplaceOrderRefundRow,
): Promise<IssueMarketplaceOrderRefundResult> {
  if (order.status === "refunded") {
    return { ok: false, error: "Order is already refunded", status: 409 }
  }

  if (order.status === "refunding") {
    if (order.payment_method !== "stripe" || !order.stripe_checkout_session_id) {
      return {
        ok: false,
        error: "This order is not waiting on a Stripe card refund.",
        status: 400,
      }
    }
    const sync = await syncMarketplaceOrderFromStripePaymentIntent(
      serviceSupabase,
      order.stripe_checkout_session_id,
    )
    if (!sync.ok) {
      console.error("[issue refund] sync while refunding", sync)
      if (sync.reason === "order_not_found") {
        return {
          ok: false,
          error: "This payment is not linked to an order in our system.",
          status: 502,
        }
      }
      return {
        ok: false,
        error: "Could not sync refund status from Stripe: " + sync.message,
        status: 502,
      }
    }
    return {
      ok: true,
      refund_type: "stripe",
      message: sync.fullyRefunded
        ? "Refund completed in Stripe — order updated."
        : "Refund status synced from Stripe. If the refund is still processing, check again shortly.",
    }
  }

  if (order.status !== "confirmed") {
    return { ok: false, error: "Only confirmed orders can be refunded", status: 400 }
  }

  if (order.payment_method === "stripe") {
    if (!order.stripe_checkout_session_id) {
      return { ok: false, error: "Missing Stripe payment reference", status: 400 }
    }

    // 1. Create Stripe refund (captures the re_… id we need for idempotency)
    const stripe = getStripe()
    let stripeRefund: Stripe.Refund
    try {
      stripeRefund = await stripe.refunds.create({
        payment_intent: order.stripe_checkout_session_id,
      })
    } catch (err) {
      if (isStripeChargeAlreadyRefundedError(err)) {
        const sync = await syncMarketplaceOrderFromStripePaymentIntent(
          serviceSupabase,
          order.stripe_checkout_session_id,
        )
        if (!sync.ok) {
          console.error("[issue refund] sync after Stripe already-refunded error", sync)
          if (sync.reason === "order_not_found") {
            return {
              ok: false,
              error: "This payment is not linked to an order in our system.",
              status: 502,
            }
          }
          return {
            ok: false,
            error: "Could not sync refund status from Stripe: " + sync.message,
            status: 502,
          }
        }
        return {
          ok: true,
          refund_type: "stripe",
          alreadyProcessedInStripe: true,
          message: sync.fullyRefunded
            ? "This payment was already refunded in Stripe. Order status has been updated."
            : "Refund status synced from Stripe.",
        }
      }
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[issue refund] Stripe refund failed:", msg)
      return { ok: false, error: "Stripe refund failed: " + msg, status: 502 }
    }

    const nowIso = new Date().toISOString()

    if (stripeRefund.status !== "succeeded") {
      await serviceSupabase
        .from("orders")
        .update({ status: "refunding", updated_at: nowIso })
        .eq("id", order.id)
        .eq("status", "confirmed")

      await serviceSupabase
        .from("payouts")
        .update({ status: "cancelled", updated_at: nowIso })
        .eq("order_id", order.id)

      return {
        ok: true,
        refund_type: "stripe",
        message:
          "Refund started — Stripe is processing it. This order will move to Refunded when Stripe completes the refund. Card refunds can take several business days to appear on the buyer’s statement.",
      }
    }

    // 2. Mark order refunded + cancel payouts
    await serviceSupabase
      .from("orders")
      .update({ status: "refunded", refunded_at: nowIso, updated_at: nowIso })
      .eq("id", order.id)
      .neq("status", "refunded")

    await serviceSupabase
      .from("payouts")
      .update({ status: "cancelled", updated_at: nowIso })
      .eq("order_id", order.id)

    // 3. Immediately claw back seller wallet so /earnings updates on the same page refresh
    await immediateSellerWalletClawback(serviceSupabase, {
      orderId: order.id,
      sellerId: order.seller_id,
      listingId: order.listing_id,
      sellerEarnings: Number(order.seller_earnings ?? 0),
      stripeRefundId: stripeRefund.id,
      refundAmountCents: stripeRefund.amount,
      piAmountCents: typeof stripeRefund.payment_intent === "object" && stripeRefund.payment_intent
        ? (stripeRefund.payment_intent as Stripe.PaymentIntent).amount
        : stripeRefund.amount,
      orderTotalUsd: Number(order.amount),
      nowIso,
    })

    // 4. Re-list
    if (order.listing_id) {
      await relistAfterRefund(serviceSupabase, order.listing_id)
    }

    return {
      ok: true,
      refund_type: "stripe",
      message: "Refund issued — the buyer's card will be refunded by Stripe shortly",
    }
  }

  if (order.payment_method === "reswell_bucks") {
    if (!order.listing_id) {
      return { ok: false, error: "Order is missing listing reference", status: 400 }
    }
    const result = await applyWalletOrderRefund(serviceSupabase, {
      id: order.id,
      listing_id: order.listing_id,
      buyer_id: order.buyer_id,
      seller_id: order.seller_id,
      amount: order.amount,
      seller_earnings: order.seller_earnings,
      status: order.status,
    })

    if (!result.ok) {
      return { ok: false, error: result.error, status: result.status }
    }

    return {
      ok: true,
      refund_type: "wallet",
      message: "Refund complete — buyer has been credited and the listing is back on the market",
    }
  }

  return {
    ok: false,
    error: `Unsupported payment method: ${order.payment_method ?? "unknown"}`,
    status: 400,
  }
}

// ── Immediate seller wallet clawback for Stripe card refunds ──────────────────
// Uses `reference_type = "stripe_refund"` + `reference_id = refund.id` so the
// later Stripe webhook (refund.created / refund.updated) finds the existing tx
// via the unique index and skips the wallet work entirely.

interface ClawbackOpts {
  orderId: string
  sellerId: string
  listingId: string | null
  sellerEarnings: number
  stripeRefundId: string
  refundAmountCents: number
  piAmountCents: number
  orderTotalUsd: number
  nowIso: string
}

async function immediateSellerWalletClawback(
  supabase: SupabaseClient,
  opts: ClawbackOpts,
): Promise<void> {
  const {
    orderId,
    sellerId,
    listingId,
    sellerEarnings,
    stripeRefundId,
    refundAmountCents,
    piAmountCents,
    orderTotalUsd,
    nowIso,
  } = opts

  if (!Number.isFinite(sellerEarnings) || sellerEarnings <= 0) {
    return
  }

  const sellerCents = Math.round(sellerEarnings * 100)
  const clawbackCents = piAmountCents > 0
    ? Math.round((sellerCents * refundAmountCents) / piAmountCents)
    : sellerCents
  const clawbackUsd = roundMoney(clawbackCents / 100)

  if (clawbackUsd <= 0) {
    return
  }

  const { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", sellerId)
    .maybeSingle()

  if (!wallet) {
    console.error("[issue refund] seller wallet not found for immediate clawback", { sellerId, orderId })
    return
  }

  const prevBalance = parseFloat(String(wallet.balance ?? 0))
  const prevPending = parseFloat(
    String((wallet as { pending_balance?: string | number | null }).pending_balance ?? 0),
  )
  const prevEarned = parseFloat(String(wallet.lifetime_earned ?? 0))

  const { data: listing } = await supabase
    .from("listings")
    .select("title")
    .eq("id", listingId ?? "")
    .maybeSingle()

  const title = typeof listing?.title === "string" ? listing.title : "Listing"
  const refundUsd = refundAmountCents / 100
  const partialNote =
    refundAmountCents < piAmountCents
      ? `partial refund $${refundUsd.toFixed(2)} of $${orderTotalUsd.toFixed(2)} card total`
      : `full refund $${refundUsd.toFixed(2)} (card total $${orderTotalUsd.toFixed(2)})`

  const split = splitSellerRefundClawback(clawbackUsd, prevPending, prevBalance)
  if (split.totalClawed <= 0) {
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
    user_id: sellerId,
    type: "refund",
    amount: -split.totalClawed,
    balance_after: split.newBalance.toFixed(2),
    description: `Refund — "${title}" (${partialNote}; ${bucketNote}; Stripe ${stripeRefundId})`,
    status: "completed",
    reference_id: stripeRefundId,
    reference_type: "stripe_refund",
  })

  if (txErr) {
    const code = (txErr as { code?: string }).code
    if (code === "23505") return
    console.error("[issue refund] seller wallet tx insert", txErr)
    return
  }

  await supabase
    .from("wallets")
    .update({
      balance: split.newBalance.toFixed(2),
      pending_balance: split.newPending.toFixed(2),
      lifetime_earned: newLifetimeEarned.toFixed(2),
      updated_at: nowIso,
    })
    .eq("id", wallet.id)
}
