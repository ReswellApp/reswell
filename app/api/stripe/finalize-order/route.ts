import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { evaluateUserPurchase } from "@/lib/services/accountRestrictions"
import {
  completeMarketplaceOrderFromPaymentIntent,
  retrieveSucceededPaymentIntent,
} from "@/lib/stripe-complete-order"
import { getPostHogServerClient } from "@/lib/posthog-server"

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: "Card payments are not configured" }, { status: 503 })
  }

  const body = (await request.json()) as { payment_intent_id?: string }
  const piId = body.payment_intent_id?.trim()
  if (!piId) {
    return NextResponse.json({ error: "Missing payment_intent_id" }, { status: 400 })
  }

  const retrieved = await retrieveSucceededPaymentIntent(piId)
  if (!retrieved.ok) {
    return NextResponse.json({ error: retrieved.error }, { status: retrieved.status })
  }

  const pi = retrieved.paymentIntent

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const purchaseGuard = await evaluateUserPurchase(supabase, user.id)
  if (!purchaseGuard.ok) {
    return NextResponse.json(
      {
        error: purchaseGuard.userMessage,
        code: purchaseGuard.error,
        restrictedUntil: purchaseGuard.restrictedUntil,
      },
      { status: 403 },
    )
  }

  const metaBuyer = pi.metadata.buyer_id?.trim()
  if (!metaBuyer || metaBuyer !== user.id) {
    return NextResponse.json({ error: "Invalid payment" }, { status: 403 })
  }

  const result = await completeMarketplaceOrderFromPaymentIntent(pi)
  if (!result.ok) {
    console.error("[finalize-order] completeMarketplaceOrder failed:", {
      error: result.error,
      status: result.status,
      piId: pi.id,
    })
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  if (!result.alreadyProcessed) {
    const posthog = getPostHogServerClient()
    if (posthog) {
      posthog.capture({
        distinctId: user.id,
        event: 'order_finalized',
        properties: {
          order_id: result.orderId,
          payment_intent_id: pi.id,
          amount_total: pi.amount / 100,
          currency: pi.currency,
          seller_id: pi.metadata.seller_id ?? undefined,
        },
      })
      await posthog.flush()
    }
  }

  return NextResponse.json({
    success: true,
    orderId: result.orderId,
    ...(result.alreadyProcessed ? { alreadyProcessed: true } : {}),
  })
}
