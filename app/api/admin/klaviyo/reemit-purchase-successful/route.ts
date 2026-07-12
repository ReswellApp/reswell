import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { reemitPurchaseSuccessfulForOrder } from "@/lib/klaviyo/reemit-purchase-successful-for-order"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { z } from "zod"

const bodySchema = z.object({
  order_id: z.string().uuid(),
})

/**
 * Admin-only: re-send Purchase Successful to Klaviyo for an existing order.
 * Refreshes listing_image_url, Items[].ImageURL, shipping_amount_display, etc.
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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "order_id (uuid) is required" }, { status: 400 })
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server config: missing service role" }, { status: 503 })
  }

  const result = await reemitPurchaseSuccessfulForOrder(service, parsed.data.order_id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    order_id: result.orderId,
    listing_image_url: result.listingImageUrl,
  })
}
