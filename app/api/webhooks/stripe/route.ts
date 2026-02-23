import { createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getSellerEarnings } from "@/lib/seller-fees"

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  const body = await request.text()
  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 })
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json(
      { error: "Server configuration error (missing service role)" },
      { status: 503 }
    )
  }

  // Cart checkout: order_id + mode=cart
  const orderId = session.metadata?.order_id
  const mode = session.metadata?.mode

  if (orderId && mode === "cart") {
    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        status: "paid",
        stripe_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    if (orderUpdateError) {
      console.error("Stripe webhook: order update failed", orderUpdateError)
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
    }

    const { data: orderItems } = await supabase
      .from("order_items")
      .select("listing_id, quantity")
      .eq("order_id", orderId)

    for (const row of orderItems || []) {
      const { data: inv } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("listing_id", row.listing_id)
        .single()

      const current = inv ? Number((inv as { quantity: number }).quantity) : 0
      const next = Math.max(0, current - row.quantity)
      await supabase
        .from("inventory")
        .update({ quantity: next, updated_at: new Date().toISOString() })
        .eq("listing_id", row.listing_id)
    }

    return NextResponse.json({ received: true })
  }

  // Single-listing checkout (used/boards)
  const listingId = session.metadata?.listing_id
  const buyerId = session.metadata?.buyer_id
  const sellerId = session.metadata?.seller_id

  if (!listingId || !buyerId || !sellerId) {
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 })
  }

  const amount = typeof session.amount_total === "number" ? session.amount_total / 100 : 0
  const price = amount
  const { marketplaceFee: platformFee, sellerEarnings } = getSellerEarnings(price, { cardPayment: true })

  const { error: purchaseError } = await supabase.from("purchases").insert({
    listing_id: listingId,
    buyer_id: buyerId,
    seller_id: sellerId,
    amount: price,
    platform_fee: platformFee,
    seller_earnings: sellerEarnings,
    status: "confirmed",
  })

  if (purchaseError) {
    console.error("Stripe webhook: purchase insert failed", purchaseError)
    return NextResponse.json({ error: "Failed to create purchase" }, { status: 500 })
  }

  const { error: listingError } = await supabase
    .from("listings")
    .update({ status: "sold" })
    .eq("id", listingId)

  if (listingError) {
    console.error("Stripe webhook: listing update failed", listingError)
  }

  return NextResponse.json({ received: true })
}
