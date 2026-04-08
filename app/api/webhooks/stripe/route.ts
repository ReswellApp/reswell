import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe-server"
import { completeMarketplaceOrderFromPaymentIntent } from "@/lib/stripe-complete-order"
import type Stripe from "stripe"

export const runtime = "nodejs"

/**
 * Stripe → Developers → Webhooks → Add endpoint: `https://<your-domain>/api/webhooks/stripe`
 * Events: `payment_intent.succeeded`
 * Signing secret: `STRIPE_WEBHOOK_SECRET` in env.
 *
 * Completes marketplace orders when the browser cannot call finalize (e.g. session cookie missing after 3DS return).
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET is not set")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 501 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(rawBody, signature, secret)
  } catch (e) {
    console.error("[stripe webhook] signature verification failed:", e)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type !== "payment_intent.succeeded") {
    return NextResponse.json({ received: true })
  }

  const piPartial = event.data.object as Stripe.PaymentIntent
  let pi: Stripe.PaymentIntent
  try {
    const stripe = getStripe()
    pi = await stripe.paymentIntents.retrieve(piPartial.id)
  } catch (e) {
    console.error("[stripe webhook] retrieve payment intent:", e)
    return NextResponse.json({ error: "retrieve_failed" }, { status: 500 })
  }

  if (pi.status !== "succeeded") {
    return NextResponse.json({ received: true, skipped: "not_succeeded" })
  }

  if (!pi.metadata?.listing_id?.trim() || !pi.metadata?.buyer_id?.trim()) {
    console.warn("[stripe webhook] payment_intent.succeeded missing marketplace metadata", pi.id)
    return NextResponse.json({ received: true, skipped: "not_marketplace" })
  }

  const result = await completeMarketplaceOrderFromPaymentIntent(pi)
  if (!result.ok) {
    console.error("[stripe webhook] complete order failed:", result.error, { pi: pi.id, status: result.status })
    if (result.status >= 500) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ received: true, skipped: "complete_failed", detail: result.error })
  }

  return NextResponse.json({ received: true, orderId: result.orderId })
}
