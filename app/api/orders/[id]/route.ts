import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { fetchBuyerOrderSuccessPayload } from "@/lib/order-success-payload"

/**
 * Order summary for authenticated buyer (checkout success, receipts).
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = await fetchBuyerOrderSuccessPayload(supabase, user.id, user.email, id)
  if (!payload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    buyerEmail: payload.buyerEmail,
    order: {
      id: payload.orderId,
      displayNumber: payload.displayNumber,
      total: payload.total,
      itemPrice: payload.itemPrice,
      shippingCost: payload.shippingCost,
      fulfillmentMethod: payload.fulfillmentMethod,
      listing: payload.listing,
      shipping: payload.shipping,
    },
  })
}
