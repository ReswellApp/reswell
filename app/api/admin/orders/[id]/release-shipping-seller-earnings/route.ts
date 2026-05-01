import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { markShippingDeliveredAndReleaseSellerEarnings } from "@/lib/services/shippingDeliveredFinalize"

const orderIdSchema = z.string().uuid()

/**
 * POST /api/admin/orders/:id/release-shipping-seller-earnings
 *
 * Full admin only (Approve payout): transitions shipped→delivered when needed, moves payout held→pending,
 * credits seller wallet (idempotent). Use after verifying the buyer received the shipment.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  const rawId = (await context.params).id
  const parsed = orderIdSchema.safeParse(rawId)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 })
  }

  const result = await markShippingDeliveredAndReleaseSellerEarnings(parsed.data)
  if (!result.ok) {
    const msg = result.error
    const badRequest =
      msg.includes("Not a shipped order") ||
      msg.includes("not active") ||
      msg.includes("must be shipped") ||
      msg.includes("Invalid fulfillment")
    return NextResponse.json({ error: msg }, { status: badRequest ? 400 : 500 })
  }

  return NextResponse.json({
    data: {
      transitionedToDelivered: result.transitionedToDelivered,
      walletReleasedNew: result.walletReleasedNew,
    },
  })
}
