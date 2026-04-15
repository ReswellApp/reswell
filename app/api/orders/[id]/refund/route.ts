import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe-server"
import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/orders/:id/refund
 * Issues a full Stripe refund for a confirmed card order.
 * Only the seller can trigger this (buyer-initiated refunds can be added later).
 * The Stripe webhook (`refund.created` / `refund.updated`, status succeeded) reverses seller earnings in the wallet.
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
    .select("id, seller_id, buyer_id, status, payment_method, stripe_checkout_session_id")
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

  if (order.payment_method !== "stripe" || !order.stripe_checkout_session_id) {
    return NextResponse.json(
      { error: "Only card (Stripe) orders can be refunded through this endpoint" },
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

  return NextResponse.json({ success: true, message: "Refund issued — order will update shortly via webhook" })
}
