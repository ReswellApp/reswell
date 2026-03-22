import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getStripe } from "@/lib/stripe-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  completeSurfboardCheckoutFromSession,
  isPeerListingCheckoutMode,
} from "@/lib/checkout/surfboard-stripe-completion"
import { completeCartCheckoutFromSession } from "@/lib/checkout/cart-stripe-completion"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Stripe webhook: confirm checkout.session.completed for peer listings (surfboards, used gear) and shop cart.
 * Requires STRIPE_WEBHOOK_SECRET and SUPABASE_SERVICE_ROLE_KEY.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()

  if (!stripe || !webhookSecret) {
    console.error("[stripe webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  const body = await request.text()
  const sig = request.headers.get("stripe-signature")
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error("[stripe webhook] Signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("[stripe webhook] SUPABASE_SERVICE_ROLE_KEY missing:", e)
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  try {
    const mode = session.metadata?.mode
    if (isPeerListingCheckoutMode(mode)) {
      const result = await completeSurfboardCheckoutFromSession(supabase, session, {})
      if (!result.ok) {
        console.error("[stripe webhook] Peer listing fulfillment failed:", result.error, session.id)
      }
    } else if (mode === "cart") {
      const result = await completeCartCheckoutFromSession(supabase, session)
      if (!result.ok) {
        console.error("[stripe webhook] Cart fulfillment failed:", result.error, session.id)
      }
    }
  } catch (e) {
    console.error("[stripe webhook] Fulfillment error:", e)
    return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
