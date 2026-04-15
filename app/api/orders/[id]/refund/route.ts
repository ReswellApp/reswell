import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe-server"
import { applyWalletOrderRefund } from "@/lib/services/walletRefund"
import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/orders/:id/refund
 *
 * Issues a full refund for a confirmed order. Supports both Stripe card and
 * Reswell Bucks payment methods.
 *
 * - **Stripe:** Creates a Stripe refund; the webhook handles wallet/order/payout/listing updates.
 * - **Reswell Bucks:** Immediately reverses seller earnings, credits buyer, cancels payouts, re-lists.
 *
 * Only the seller can trigger this endpoint.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const serviceSupabase = createServiceRoleClient()

  const { data: order, error: fetchErr } = await serviceSupabase
    .from("orders")
    .select(
      "id, seller_id, buyer_id, listing_id, amount, seller_earnings, status, payment_method, stripe_checkout_session_id",
    )
    .eq("id", orderId)
    .single()

  if (fetchErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (order.seller_id !== user.id) {
    return NextResponse.json({ error: "Only the seller can issue a refund" }, { status: 403 })
  }

  if (order.status === "refunded") {
    return NextResponse.json({ error: "Order is already refunded" }, { status: 409 })
  }

  if (order.status !== "confirmed") {
    return NextResponse.json({ error: "Only confirmed orders can be refunded" }, { status: 400 })
  }

  // ── Stripe card refund ──────────────────────────────────────────
  if (order.payment_method === "stripe") {
    if (!order.stripe_checkout_session_id) {
      return NextResponse.json(
        { error: "Missing Stripe payment reference" },
        { status: 400 },
      )
    }

    try {
      const stripe = getStripe()
      await stripe.refunds.create({
        payment_intent: order.stripe_checkout_session_id,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[refund] Stripe refund failed:", msg)
      return NextResponse.json({ error: "Stripe refund failed: " + msg }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      refund_type: "stripe" as const,
      message: "Refund issued — order will update shortly via webhook",
    })
  }

  // ── Reswell Bucks refund ────────────────────────────────────────
  if (order.payment_method === "reswell_bucks") {
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
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      success: true,
      refund_type: "wallet" as const,
      message: "Refund complete — buyer has been credited and the listing is back on the market",
    })
  }

  return NextResponse.json(
    { error: `Unsupported payment method: ${order.payment_method}` },
    { status: 400 },
  )
}
