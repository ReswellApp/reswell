import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  completeMarketplaceOrderFromPaymentIntent,
  retrieveSucceededPaymentIntent,
} from "@/lib/stripe-complete-order"
import { z } from "zod"

const bodySchema = z.object({
  payment_intent_id: z.string().trim().min(1),
})

/**
 * POST /api/admin/orders/recover-stripe-payment
 *
 * Completes a marketplace order from a succeeded Stripe PaymentIntent when the buyer
 * finalize call and webhook both missed (e.g. disabled webhook endpoint, lost session after 3DS).
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  let parsedBody: z.infer<typeof bodySchema>
  try {
    const raw = (await request.json()) as unknown
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    parsedBody = parsed.data
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const retrieved = await retrieveSucceededPaymentIntent(parsedBody.payment_intent_id)
  if (!retrieved.ok) {
    return NextResponse.json({ error: retrieved.error }, { status: retrieved.status })
  }

  const result = await completeMarketplaceOrderFromPaymentIntent(retrieved.paymentIntent)
  if (!result.ok) {
    console.error("[admin/recover-stripe-payment] failed:", {
      piId: parsedBody.payment_intent_id,
      error: result.error,
      status: result.status,
    })
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    success: true,
    orderId: result.orderId,
    ...(result.alreadyProcessed ? { alreadyProcessed: true } : {}),
  })
}
