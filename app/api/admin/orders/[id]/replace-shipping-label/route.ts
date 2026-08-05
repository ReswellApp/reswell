import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  getAdminReplaceOrderShippingLabelOverview,
  purchaseAdminExactParcelReplacementLabelForOrder,
  quoteAdminExactParcelUpsRatesForOrder,
} from "@/lib/services/adminReplaceOrderShippingLabel"
import { adminReplaceOrderShippingLabelPostBodySchema } from "@/lib/validations/admin-replace-order-shipping-label"

export const dynamic = "force-dynamic"

const orderIdSchema = z.string().uuid()

/**
 * GET /api/admin/orders/:id/replace-shipping-label
 * Overview for the exact-box UPS label replace tool on the order detail page.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const rawId = (await context.params).id
  const parsed = orderIdSchema.safeParse(rawId)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const result = await getAdminReplaceOrderShippingLabelOverview({
    supabase,
    orderId: parsed.data,
    adminUserId: gate.ctx.user.id,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: result.data })
}

/**
 * POST /api/admin/orders/:id/replace-shipping-label
 * actions: rates | purchase
 * Reswell admin pays for the new UPS label; prior label is voided best-effort.
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

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminReplaceOrderShippingLabelPostBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()
  const orderId = idParsed.data
  const body = parsed.data

  if (body.action === "rates") {
    const result = await quoteAdminExactParcelUpsRatesForOrder({
      supabase,
      orderId,
      adminUserId: gate.ctx.user.id,
      parcel: {
        lengthIn: body.parcel.length_in,
        widthIn: body.parcel.width_in,
        heightIn: body.parcel.height_in,
        weightLb: body.parcel.weight_lb,
      },
      shipFromAddressId: body.ship_from_address_id,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  }

  const result = await purchaseAdminExactParcelReplacementLabelForOrder({
    supabase,
    adminUserId: gate.ctx.user.id,
    orderId,
    parcel: {
      lengthIn: body.parcel.length_in,
      widthIn: body.parcel.width_in,
      heightIn: body.parcel.height_in,
      weightLb: body.parcel.weight_lb,
    },
    rateId: body.rate_id,
    shipFromAddressId: body.ship_from_address_id,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: result.data })
}
