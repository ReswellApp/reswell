import { NextResponse } from "next/server"
import {
  constructStripeWebhookEvent,
  getStripe,
  parseStripeWebhookSigningSecrets,
} from "@/lib/stripe-server"
import { completeMarketplaceOrderFromPaymentIntent } from "@/lib/stripe-complete-order"
import { completePosOrderFromPaymentIntent } from "@/lib/services/posSale"
import { marketplaceListingIdsFromPaymentIntent } from "@/lib/stripe-marketplace-metadata"
import {
  completeSellerShippingLabelFromPaymentIntent,
  isSellerShippingLabelPaymentIntent,
} from "@/lib/services/sellerShippingLabelCheckout"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { tryHandleStripeConnectEvent } from "@/lib/services/stripeConnectWebhook"
import {
  tryHandleStripeChargeRefundedEvent,
  tryHandleStripeRefundEvent,
} from "@/lib/services/stripeRefundWebhook"
import type Stripe from "stripe"

export const runtime = "nodejs"

/**
 * Stripe → Developers → Webhooks → Add endpoint: `https://<your-domain>/api/webhooks/stripe`
 * Events: `payment_intent.succeeded`, `refund.created`, `refund.updated`, `charge.refunded`,
 * `account.updated`, `transfer.reversed`, `payout.failed`, `payout.canceled` (Connect)
 * Signing secret: `STRIPE_WEBHOOK_SECRET` — one value, or comma/newline-separated during rotation.
 *
 * Use the **canonical** host Vercel serves without a redirect (www vs apex). Stripe does not follow
 * 308/301 redirects on webhook POSTs — a redirect causes delivery failures.
 *
 * Completes marketplace orders when the browser cannot call finalize (e.g. session cookie missing after 3DS return).
 */
export async function POST(request: Request) {
  const secretsRaw = process.env.STRIPE_WEBHOOK_SECRET ?? ""
  const secretSegments = parseStripeWebhookSigningSecrets(secretsRaw)
  if (secretSegments.length === 0) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET is not set or empty after parsing")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 501 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = constructStripeWebhookEvent(rawBody, signature, secretsRaw)
  } catch (e) {
    console.error("[stripe webhook] signature verification failed:", e, {
      signing_secret_segments_configured: secretSegments.length,
      hint:
        "STRIPE_WEBHOOK_SECRET must be the Signing secret for this exact endpoint URL (Live mode Dashboard → Developers → Webhooks). Test CLI whsec_* will not verify live deliveries.",
    })
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const connectHandled = await tryHandleStripeConnectEvent(event)
  if (connectHandled) {
    return NextResponse.json({ received: true })
  }

  const refundHandled = await tryHandleStripeRefundEvent(event)
  if (refundHandled) {
    return NextResponse.json({ received: true })
  }

  const chargeRefundedHandled = await tryHandleStripeChargeRefundedEvent(event)
  if (chargeRefundedHandled) {
    return NextResponse.json({ received: true })
  }

  if (event.type !== "payment_intent.succeeded") {
    return NextResponse.json({ received: true })
  }

  console.info("[stripe webhook] payment_intent.succeeded", {
    id: event.id,
    livemode: event.livemode,
    pi: (event.data.object as Stripe.PaymentIntent).id,
  })

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

  if (isSellerShippingLabelPaymentIntent(pi)) {
    let serviceSupabase
    try {
      serviceSupabase = createServiceRoleClient()
    } catch (e) {
      console.error("[stripe webhook] service role client for seller label:", e)
      return NextResponse.json({ error: "server_config" }, { status: 503 })
    }

    const result = await completeSellerShippingLabelFromPaymentIntent({
      supabase: serviceSupabase,
      paymentIntent: pi,
    })
    if (!result.ok) {
      console.error("[stripe webhook] seller label purchase failed:", result.error, { pi: pi.id })
      if (result.status >= 500) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
      return NextResponse.json({ received: true, skipped: "seller_label_failed", detail: result.error })
    }

    return NextResponse.json({
      received: true,
      orderId: result.orderId,
      sellerLabel: true,
      alreadyProcessed: result.alreadyProcessed,
    })
  }

  if (pi.metadata?.sales_channel === "pos") {
    const posResult = await completePosOrderFromPaymentIntent(pi)
    if (!posResult.ok) {
      console.error("[stripe webhook] pos sale settle failed:", posResult.error, { pi: pi.id })
      if (posResult.status >= 500) {
        return NextResponse.json({ error: posResult.error }, { status: 500 })
      }
      return NextResponse.json({ received: true, skipped: "pos_failed", detail: posResult.error })
    }
    return NextResponse.json({
      received: true,
      orderId: posResult.orderId,
      pos: true,
      alreadyProcessed: posResult.alreadyProcessed,
    })
  }

  if (!marketplaceListingIdsFromPaymentIntent(pi).length || !pi.metadata?.buyer_id?.trim()) {
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
