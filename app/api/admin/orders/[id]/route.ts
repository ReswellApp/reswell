import { NextResponse } from "next/server"
import { z } from "zod"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireAdmin, requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { getOrderDetailForAdmin, isPostgrestSchemaStaleError } from "@/lib/db/adminOrders"
import { deleteAdminTestOrderService } from "@/lib/services/adminOrderDelete"

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
    if (isPostgrestSchemaStaleError(error)) {
      console.error("[admin orders GET] schema/cache mismatch", error.code, error.message)
      return NextResponse.json(
        {
          error:
            "Database API schema is out of date (often after a migration). Confirm `orders.shipping_amount` exists, apply pending migrations, then in Supabase: Project Settings → API → Reload schema.",
        },
        { status: 503 },
      )
    }
    console.error("[admin orders GET]", error)
    return NextResponse.json({ error: "Could not load order" }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  return NextResponse.json({
    data,
    capabilities: {
      canRefund: gate.ctx.isAdmin,
      canReleaseShippingSellerEarnings: gate.ctx.isAdmin,
    },
  })
}

/**
 * DELETE /api/admin/orders/:id
 *
 * Admin only — permanently remove an admin-seeded **test** order. Real orders are refused.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  const rawId = (await context.params).id
  const parsed = orderIdSchema.safeParse(rawId)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 })
  }

  const result = await deleteAdminTestOrderService(parsed.data, { adminId: gate.ctx.user.id })
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ success: true, data: { orderNum: result.orderNum } }, { status: 200 })
}
