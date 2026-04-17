import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { syncMarketplaceOrderFromStripePaymentIntent } from "@/lib/services/stripeRefundWebhook"

const bodySchema = z.object({
  paymentIntentId: z.string().optional(),
  orderId: z.string().uuid().optional(),
})

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single()

  if (!profile?.is_admin) return null
  return user
}

/**
 * Re-run marketplace Stripe refund reconciliation for a card order: sync order/payout state from
 * Stripe refund totals and create any missing seller wallet clawback rows (idempotent).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const piTrim = parsed.data.paymentIntentId?.trim() ?? ""
  const orderId = parsed.data.orderId

  if (!piTrim && !orderId) {
    return NextResponse.json(
      { error: "Provide paymentIntentId (Stripe pi_…) or orderId (UUID)." },
      { status: 400 },
    )
  }

  let paymentIntentId = piTrim.length > 0 ? piTrim : null
  const serviceSupabase = createServiceRoleClient()

  if (orderId && !paymentIntentId) {
    const { data: order, error } = await serviceSupabase
      .from("orders")
      .select("stripe_checkout_session_id, payment_method")
      .eq("id", orderId)
      .maybeSingle()

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (order.payment_method !== "stripe" || !order.stripe_checkout_session_id) {
      return NextResponse.json(
        {
          error:
            "That order is not a Stripe card checkout, or it has no payment intent stored.",
        },
        { status: 400 },
      )
    }

    paymentIntentId = order.stripe_checkout_session_id
  }

  if (!paymentIntentId) {
    return NextResponse.json({ error: "Could not resolve payment intent" }, { status: 400 })
  }

  if (!paymentIntentId.startsWith("pi_")) {
    return NextResponse.json(
      { error: "Payment intent id must start with pi_ (Stripe PaymentIntent)." },
      { status: 400 },
    )
  }

  const result = await syncMarketplaceOrderFromStripePaymentIntent(serviceSupabase, paymentIntentId)

  if (!result.ok) {
    if (result.reason === "order_not_found") {
      return NextResponse.json(
        {
          error:
            "No Stripe marketplace order in the database matches this payment intent. Check the id or use order id from Admin → Orders.",
        },
        { status: 404 },
      )
    }
    return NextResponse.json({ error: result.message }, { status: 502 })
  }

  return NextResponse.json({
    ok: true as const,
    orderId: result.orderId,
    fullyRefunded: result.fullyRefunded,
    paymentIntentId,
  })
}
