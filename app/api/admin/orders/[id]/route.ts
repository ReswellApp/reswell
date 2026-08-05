import { NextResponse } from "next/server"
import { z } from "zod"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireAdmin, requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { getOrderDetailForAdmin, isPostgrestSchemaStaleError } from "@/lib/db/adminOrders"
import { deleteAdminTestOrderService } from "@/lib/services/adminOrderDelete"
import {
  getLatestPreparedShippingLabelForOrder,
  preparedLabelHasPaperlessQr,
} from "@/lib/db/orderShippingLabels"
import { orderHasAccessibleShippingLabelPdf } from "@/lib/services/resolveOrderShippingLabelPdf"

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

  const hasShippingLabel = await orderHasAccessibleShippingLabelPdf(serviceSupabase, {
    orderId: parsed.data,
    trackingNumber: data.tracking_number,
  })
  const preparedShippingLabel = await getLatestPreparedShippingLabelForOrder(
    serviceSupabase,
    parsed.data,
  )
  const hasPaperlessQr = preparedLabelHasPaperlessQr(preparedShippingLabel)

  const canFulfillReswellShop =
    gate.ctx.isAdmin &&
    data.is_reswell_shop &&
    data.status === "confirmed" &&
    data.fulfillment_method === "shipping" &&
    data.delivery_status === "pending" &&
    Boolean(data.buyer_id)

  const canReplaceShippingLabel =
    gate.ctx.isAdmin &&
    !data.is_reswell_shop &&
    data.fulfillment_method === "shipping" &&
    (data.status === "confirmed" || data.status === "refunding") &&
    data.delivery_status !== "delivered" &&
    data.delivery_status !== "picked_up"

  return NextResponse.json({
    data,
    capabilities: {
      canRefund: gate.ctx.isAdmin,
      canReleaseShippingSellerEarnings: gate.ctx.isAdmin && !data.is_reswell_shop,
      hasShippingLabel,
      hasPaperlessQr,
      paperlessInstructions: preparedShippingLabel?.paperless_instructions ?? null,
      paperlessHandoffCode: preparedShippingLabel?.paperless_handoff_code ?? null,
      canFulfillReswellShop,
      canReplaceShippingLabel,
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
