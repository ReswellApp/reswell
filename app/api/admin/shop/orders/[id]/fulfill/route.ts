import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { fulfillReswellShopOrder } from "@/lib/services/reswellShopOrderFulfillment"
import { reswellShopOrderFulfillBodySchema } from "@/lib/validations/reswellShopOrderFulfillment"

const orderIdSchema = z.string().uuid()

/**
 * POST /api/admin/shop/orders/:id/fulfill
 *
 * Purchase a ShipEngine label from the shop product package dims, attach tracking,
 * mark shipped, and fire Klaviyo **Order Shipped**.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const rawId = (await context.params).id
  const idParsed = orderIdSchema.safeParse(rawId)
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 })
  }

  // Body is optional — accept empty / missing JSON.
  let json: unknown = {}
  try {
    const text = await request.text()
    if (text.trim()) {
      json = JSON.parse(text) as unknown
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = reswellShopOrderFulfillBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const serviceSupabase = createServiceRoleClient()
  const result = await fulfillReswellShopOrder(serviceSupabase, {
    orderId: idParsed.data,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    success: true,
    data: {
      trackingNumber: result.trackingNumber,
      trackingCarrier: result.trackingCarrier,
      labelUrl: result.labelUrl,
      alreadyPurchased: result.alreadyPurchased,
    },
  })
}
