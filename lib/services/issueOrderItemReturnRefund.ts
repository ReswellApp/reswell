import type { SupabaseClient } from "@supabase/supabase-js"
import Stripe from "stripe"
import { getStripe } from "@/lib/stripe-server"
import {
  getOrderItemReturnById,
  listOrderItemReturnsForOrder,
  updateOrderItemReturn,
} from "@/lib/db/orderItemReturns"
import { relistAfterRefund } from "@/lib/services/listingRelist"
import { applySellerRefundClawback } from "@/lib/split-seller-refund-clawback"
import { ensureOrderRefundedSellerThreadNotification } from "@/lib/services/postOrderRefundedThreadNotification"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function isStripeChargeAlreadyRefundedError(err: unknown): boolean {
  if (err instanceof Stripe.errors.StripeInvalidRequestError) {
    if (err.code === "charge_already_refunded") return true
  }
  const msg = err instanceof Error ? err.message : String(err)
  return /already been refunded/i.test(msg)
}

async function clawbackSellerForReturn(
  supabase: SupabaseClient,
  opts: {
    orderId: string
    sellerId: string
    listingId: string
    clawbackUsd: number
    referenceId: string
    referenceType: "stripe_refund" | "order_item_return_refund"
    description: string
    nowIso: string
  },
): Promise<void> {
  if (opts.clawbackUsd <= 0) return

  const { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", opts.sellerId)
    .maybeSingle()

  if (!wallet) {
    console.error("[issueOrderItemReturnRefund] seller wallet missing", opts.sellerId)
    return
  }

  const prevBalance = parseFloat(String(wallet.balance ?? 0))
  const prevPending = parseFloat(
    String((wallet as { pending_balance?: string | number | null }).pending_balance ?? 0),
  )
  const prevEarned = parseFloat(String(wallet.lifetime_earned ?? 0))
  const rev = applySellerRefundClawback(
    { balance: prevBalance, pending: prevPending, lifetimeEarned: prevEarned },
    opts.clawbackUsd,
  )
  const { split } = rev

  const { error: txErr } = await supabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: opts.sellerId,
    type: "refund",
    amount: -split.totalClawed,
    balance_after: split.newBalance.toFixed(2),
    description: opts.description,
    status: "completed",
    reference_id: opts.referenceId,
    reference_type: opts.referenceType,
  })

  if (txErr) {
    const code = (txErr as { code?: string }).code
    if (code === "23505") return
    console.error("[issueOrderItemReturnRefund] seller tx", txErr)
    return
  }

  await supabase
    .from("wallets")
    .update({
      balance: split.newBalance.toFixed(2),
      pending_balance: split.newPending.toFixed(2),
      lifetime_earned: rev.newLifetimeEarned.toFixed(2),
      updated_at: opts.nowIso,
    })
    .eq("id", wallet.id)
}

async function creditBuyerPartial(
  supabase: SupabaseClient,
  opts: {
    orderId: string
    buyerId: string
    listingId: string
    creditUsd: number
    referenceId: string
    nowIso: string
  },
): Promise<void> {
  if (opts.creditUsd <= 0) return

  let { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", opts.buyerId)
    .maybeSingle()

  if (!wallet) {
    const { data: created } = await supabase
      .from("wallets")
      .insert({ user_id: opts.buyerId })
      .select()
      .single()
    wallet = created
  }
  if (!wallet) return

  const prevBalance = parseFloat(String(wallet.balance ?? 0))
  const prevSpent = parseFloat(String(wallet.lifetime_spent ?? 0))
  const newBalance = roundMoney(prevBalance + opts.creditUsd)
  const newSpent = roundMoney(Math.max(0, prevSpent - opts.creditUsd))

  const { data: listing } = await supabase
    .from("listings")
    .select("title")
    .eq("id", opts.listingId)
    .maybeSingle()
  const title = typeof listing?.title === "string" ? listing.title : "Listing"

  const { error: txErr } = await supabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: opts.buyerId,
    type: "refund",
    amount: opts.creditUsd,
    balance_after: newBalance.toFixed(2),
    description: `Item return refund — "${title}" ($${opts.creditUsd.toFixed(2)})`,
    status: "completed",
    reference_id: opts.referenceId,
    reference_type: "order_item_return_refund",
  })

  if (txErr) {
    const code = (txErr as { code?: string }).code
    if (code === "23505") return
    console.error("[issueOrderItemReturnRefund] buyer tx", txErr)
    return
  }

  await supabase
    .from("wallets")
    .update({
      balance: newBalance.toFixed(2),
      lifetime_spent: newSpent.toFixed(2),
      updated_at: opts.nowIso,
    })
    .eq("id", wallet.id)
}

async function maybeMarkOrderFullyRefunded(
  supabase: SupabaseClient,
  orderId: string,
  nowIso: string,
): Promise<boolean> {
  const [{ data: order }, { data: items }, returns] = await Promise.all([
    supabase
      .from("orders")
      .select("id, listing_id, amount, shipping_amount, status")
      .eq("id", orderId)
      .maybeSingle(),
    supabase.from("order_items").select("id, listing_id").eq("order_id", orderId),
    listOrderItemReturnsForOrder(supabase, orderId),
  ])

  if (!order || (order as { status: string }).status === "refunded") return false

  const refundedListingIds = new Set(
    returns.filter((r) => r.status === "refunded").map((r) => r.listing_id),
  )

  const lineListingIds: string[] = items?.length
    ? items.map((r) => (r as { listing_id: string }).listing_id)
    : [(order as { listing_id: string | null }).listing_id].filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      )

  if (lineListingIds.length === 0) return false
  const allRefunded = lineListingIds.every((id) => refundedListingIds.has(id))
  if (!allRefunded) return false

  await supabase
    .from("orders")
    .update({ status: "refunded", refunded_at: nowIso, updated_at: nowIso })
    .eq("id", orderId)
    .neq("status", "refunded")

  await supabase
    .from("payouts")
    .update({ status: "cancelled", updated_at: nowIso })
    .eq("order_id", orderId)

  await ensureOrderRefundedSellerThreadNotification(supabase, orderId)
  return true
}

export type IssueOrderItemReturnRefundResult =
  | { ok: true; refundType: "stripe" | "wallet"; fullyOrderRefunded: boolean; message: string }
  | { ok: false; error: string; status: number }

/**
 * Partial refund for one authorized return after return delivery + 24h hold.
 */
export async function issueOrderItemReturnRefund(
  supabase: SupabaseClient,
  returnId: string,
): Promise<IssueOrderItemReturnRefundResult> {
  const ret = await getOrderItemReturnById(supabase, returnId)
  if (!ret) return { ok: false, error: "Return not found", status: 404 }

  if (ret.status === "refunded" || ret.refunded_at) {
    return {
      ok: true,
      refundType: ret.stripe_refund_id ? "stripe" : "wallet",
      fullyOrderRefunded: false,
      message: "Return already refunded",
    }
  }

  if (ret.status === "cancelled") {
    return { ok: false, error: "Return is cancelled", status: 400 }
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      "id, seller_id, buyer_id, listing_id, amount, seller_earnings, status, payment_method, stripe_checkout_session_id",
    )
    .eq("id", ret.order_id)
    .maybeSingle()

  if (orderErr || !order) {
    return { ok: false, error: "Order not found", status: 404 }
  }

  const orderRow = order as {
    id: string
    seller_id: string
    buyer_id: string
    listing_id: string | null
    amount: number | string
    seller_earnings: number | string | null
    status: string
    payment_method: string | null
    stripe_checkout_session_id: string | null
  }

  if (orderRow.status === "refunded") {
    await updateOrderItemReturn(supabase, returnId, {
      status: "refunded",
      refunded_at: new Date().toISOString(),
    })
    return {
      ok: true,
      refundType: "stripe",
      fullyOrderRefunded: true,
      message: "Order already fully refunded",
    }
  }

  if (orderRow.status !== "confirmed" && orderRow.status !== "refunding") {
    return { ok: false, error: "Order is not eligible for item refund", status: 400 }
  }

  const refundAmountUsd = roundMoney(Number(ret.refund_amount_usd))
  const clawbackUsd = roundMoney(Number(ret.seller_clawback_usd))
  const nowIso = new Date().toISOString()

  await updateOrderItemReturn(supabase, returnId, { status: "refund_pending" })

  const { data: listing } = await supabase
    .from("listings")
    .select("title")
    .eq("id", ret.listing_id)
    .maybeSingle()
  const title = typeof listing?.title === "string" ? listing.title : "Listing"

  if (orderRow.payment_method === "stripe") {
    if (!orderRow.stripe_checkout_session_id) {
      return { ok: false, error: "Missing Stripe payment reference", status: 400 }
    }

    const stripe = getStripe()
    const amountCents = Math.round(refundAmountUsd * 100)
    if (amountCents <= 0) {
      return { ok: false, error: "Refund amount must be positive", status: 400 }
    }

    let stripeRefund: Stripe.Refund
    try {
      stripeRefund = await stripe.refunds.create({
        payment_intent: orderRow.stripe_checkout_session_id,
        amount: amountCents,
        metadata: {
          order_id: orderRow.id,
          order_item_return_id: returnId,
          listing_id: ret.listing_id,
        },
      })
    } catch (err) {
      if (isStripeChargeAlreadyRefundedError(err)) {
        // Fall through — mark return refunded if Stripe already covered this PI fully.
        await updateOrderItemReturn(supabase, returnId, {
          status: "refunded",
          refunded_at: nowIso,
        })
        await relistAfterRefund(supabase, ret.listing_id)
        const fully = await maybeMarkOrderFullyRefunded(supabase, orderRow.id, nowIso)
        return {
          ok: true,
          refundType: "stripe",
          fullyOrderRefunded: fully,
          message: "Payment already refunded in Stripe; return marked refunded.",
        }
      }
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[issueOrderItemReturnRefund] Stripe:", msg)
      await updateOrderItemReturn(supabase, returnId, { status: "delivered" })
      return { ok: false, error: "Stripe refund failed: " + msg, status: 502 }
    }

    if (stripeRefund.status !== "succeeded" && stripeRefund.status !== "pending") {
      await updateOrderItemReturn(supabase, returnId, { status: "delivered" })
      return {
        ok: false,
        error: `Stripe refund status: ${stripeRefund.status}`,
        status: 502,
      }
    }

    await clawbackSellerForReturn(supabase, {
      orderId: orderRow.id,
      sellerId: orderRow.seller_id,
      listingId: ret.listing_id,
      clawbackUsd,
      referenceId: stripeRefund.id,
      referenceType: "stripe_refund",
      description: `Item return refund — "${title}" ($${refundAmountUsd.toFixed(2)}; Stripe ${stripeRefund.id})`,
      nowIso,
    })

    // Adjust held payout amount proportionally when not cancelling the whole order.
    const { data: payout } = await supabase
      .from("payouts")
      .select("id, amount, status")
      .eq("order_id", orderRow.id)
      .maybeSingle()

    if (payout && (payout as { status: string }).status === "held") {
      const prev = roundMoney(Number((payout as { amount: number | string }).amount))
      const next = roundMoney(Math.max(0, prev - clawbackUsd))
      await supabase
        .from("payouts")
        .update({ amount: next, updated_at: nowIso })
        .eq("id", (payout as { id: string }).id)
    }

    await updateOrderItemReturn(supabase, returnId, {
      status: "refunded",
      refunded_at: nowIso,
      stripe_refund_id: stripeRefund.id,
    })

    await relistAfterRefund(supabase, ret.listing_id)
    const fully = await maybeMarkOrderFullyRefunded(supabase, orderRow.id, nowIso)

    return {
      ok: true,
      refundType: "stripe",
      fullyOrderRefunded: fully,
      message: fully
        ? "Item refunded — entire order is now refunded."
        : "Item refunded to the buyer's original payment method.",
    }
  }

  if (orderRow.payment_method === "reswell_bucks") {
    await clawbackSellerForReturn(supabase, {
      orderId: orderRow.id,
      sellerId: orderRow.seller_id,
      listingId: ret.listing_id,
      clawbackUsd,
      referenceId: returnId,
      referenceType: "order_item_return_refund",
      description: `Item return refund — "${title}" ($${refundAmountUsd.toFixed(2)}; wallet)`,
      nowIso,
    })

    await creditBuyerPartial(supabase, {
      orderId: orderRow.id,
      buyerId: orderRow.buyer_id,
      listingId: ret.listing_id,
      creditUsd: refundAmountUsd,
      referenceId: returnId,
      nowIso,
    })

    const { data: payout } = await supabase
      .from("payouts")
      .select("id, amount, status")
      .eq("order_id", orderRow.id)
      .maybeSingle()

    if (payout && (payout as { status: string }).status === "held") {
      const prev = roundMoney(Number((payout as { amount: number | string }).amount))
      const next = roundMoney(Math.max(0, prev - clawbackUsd))
      await supabase
        .from("payouts")
        .update({ amount: next, updated_at: nowIso })
        .eq("id", (payout as { id: string }).id)
    }

    await updateOrderItemReturn(supabase, returnId, {
      status: "refunded",
      refunded_at: nowIso,
    })

    await relistAfterRefund(supabase, ret.listing_id)
    const fully = await maybeMarkOrderFullyRefunded(supabase, orderRow.id, nowIso)

    return {
      ok: true,
      refundType: "wallet",
      fullyOrderRefunded: fully,
      message: fully
        ? "Item refunded — entire order is now refunded."
        : "Item refunded to the buyer's Reswell Bucks balance.",
    }
  }

  await updateOrderItemReturn(supabase, returnId, { status: "delivered" })
  return {
    ok: false,
    error: `Unsupported payment method: ${orderRow.payment_method ?? "unknown"}`,
    status: 400,
  }
}
