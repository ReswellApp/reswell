import { NextResponse } from "next/server"
import { z } from "zod"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  adminOrderStaffCapabilities,
  type AdminOrderCapabilities,
} from "@/lib/admin/admin-order-capabilities"
import { getOrderDetailForAdmin, isPostgrestSchemaStaleError } from "@/lib/db/adminOrders"
import { dbGetIncreasedAdjustmentTotalsByOrderIds } from "@/lib/db/shipengineLabelAdjustments"
import {
  fetchProfileAddresses,
  preferredProfileAddress,
  profileAddressOneLine,
} from "@/lib/db/profile-addresses"
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
  const gate = await requireAdmin()
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

  const [hasShippingLabel, preparedShippingLabel, sellerAddresses, adjustments] = await Promise.all([
    orderHasAccessibleShippingLabelPdf(serviceSupabase, {
      orderId: parsed.data,
      trackingNumber: data.tracking_number,
    }),
    getLatestPreparedShippingLabelForOrder(serviceSupabase, parsed.data),
    fetchProfileAddresses(serviceSupabase, data.seller_id),
    dbGetIncreasedAdjustmentTotalsByOrderIds(serviceSupabase, [parsed.data]),
  ])
  if (adjustments.error) {
    console.error("[admin order adjustments]", adjustments.error)
    return NextResponse.json({ error: "Could not load shipping adjustments" }, { status: 500 })
  }
  const hasPaperlessQr = preparedLabelHasPaperlessQr(preparedShippingLabel)
  const preferredShipFrom = preferredProfileAddress(sellerAddresses.addresses)
  const shipFromOnFile = preferredShipFrom
    ? {
        name: preferredShipFrom.full_name.trim() || "Seller",
        oneLine: profileAddressOneLine(preferredShipFrom),
      }
    : null

  const staff = adminOrderStaffCapabilities({
    isAdmin: gate.ctx.isAdmin,
    isReswellShop: data.is_reswell_shop,
    status: data.status,
    fulfillmentMethod: data.fulfillment_method,
    deliveryStatus: data.delivery_status,
    hasBuyer: Boolean(data.buyer_id),
  })

  const capabilities: AdminOrderCapabilities = {
    ...staff,
    hasShippingLabel,
    hasPaperlessQr,
    paperlessInstructions: preparedShippingLabel?.paperless_instructions ?? null,
    paperlessHandoffCode: preparedShippingLabel?.paperless_handoff_code ?? null,
    shipFromOnFile,
  }

  return NextResponse.json({
    data: {
      ...data,
      shipping_adjusted_fee: adjustments.data.get(parsed.data)?.recordedUsd ?? 0,
      shipping_adjusted_fee_charged: adjustments.data.get(parsed.data)?.chargedUsd ?? 0,
    },
    capabilities,
  })
}
