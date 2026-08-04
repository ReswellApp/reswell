import { NextResponse } from "next/server"
import { z } from "zod"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { confirmOrderItemReturnReceipt } from "@/lib/services/confirmOrderItemReturnReceipt"

export const dynamic = "force-dynamic"

const uuidSchema = z.string().uuid()

/**
 * POST /api/admin/orders/:id/returns/:returnId/confirm-receipt
 * Marks return delivered (starts 24h refund clock) when carrier tracking is stuck.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; returnId: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id, returnId } = await context.params
  const orderParsed = uuidSchema.safeParse(id)
  const returnParsed = uuidSchema.safeParse(returnId)
  if (!orderParsed.success || !returnParsed.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const result = await confirmOrderItemReturnReceipt({
    supabase,
    orderId: orderParsed.data,
    returnId: returnParsed.data,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    data: { carrier_delivered_at: result.carrierDeliveredAt },
  })
}
