import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import {
  completeMarketplaceOrderFromPaymentIntent,
  retrieveSucceededPaymentIntent,
} from "@/lib/stripe-complete-order"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
  const metaBuyer = pi.metadata.buyer_id?.trim()
  if (!metaBuyer || metaBuyer !== user.id) {
    return NextResponse.json({ error: "Invalid payment" }, { status: 403 })
  }

  const result = await completeMarketplaceOrderFromPaymentIntent(pi)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    success: true,
    orderId: result.orderId,
    ...(result.alreadyProcessed ? { alreadyProcessed: true } : {}),
  })
}
