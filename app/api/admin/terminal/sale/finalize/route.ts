import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { getStripe } from "@/lib/stripe-server"
import {
  ADMIN_TERMINAL_SALES_CHANNEL,
  finalizeAdminTerminalSale,
} from "@/lib/services/adminTerminalSale"
import { adminTerminalSaleFinalizeSchema } from "@/lib/validations/adminTerminalSale"

/**
 * Polled by the admin register after the reader collects payment. Settles the marketplace order
 * when the PaymentIntent succeeds (idempotent; the Stripe webhook also settles).
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = adminTerminalSaleFinalizeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const stripe = getStripe()
  let pi
  try {
    pi = await stripe.paymentIntents.retrieve(parsed.data.paymentIntentId)
  } catch {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 })
  }

  if (pi.metadata?.sales_channel !== ADMIN_TERMINAL_SALES_CHANNEL) {
    return NextResponse.json({ error: "Not an admin terminal payment" }, { status: 400 })
  }

  if (pi.status !== "succeeded") {
    return NextResponse.json({ data: { status: pi.status, settled: false } })
  }

  const result = await finalizeAdminTerminalSale(parsed.data.paymentIntentId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    data: {
      status: "succeeded",
      settled: true,
      orderId: result.orderId,
      alreadyProcessed: result.alreadyProcessed ?? false,
    },
  })
}
