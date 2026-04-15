import { NextResponse } from "next/server"
import { z } from "zod"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { getOrderDetailForAdmin } from "@/lib/db/adminOrders"

const orderIdSchema = z.string().uuid()

/**
 * GET /api/admin/orders/:id
 *
 * Order detail for admin / support (bypasses buyer/seller RLS). Refund actions use POST …/refund.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) {
    return gate.response
  }

  const rawId = (await context.params).id
  const parsed = orderIdSchema.safeParse(rawId)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 })
  }

  const serviceSupabase = createServiceRoleClient()
  const { data, error } = await getOrderDetailForAdmin(serviceSupabase, parsed.data)

  if (error) {
    console.error("[admin orders GET]", error)
    return NextResponse.json({ error: "Could not load order" }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  return NextResponse.json({
    data,
    capabilities: { canRefund: gate.ctx.isAdmin },
  })
}
