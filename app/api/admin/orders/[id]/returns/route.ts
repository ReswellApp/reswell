import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { listOrderItemReturnsForOrder } from "@/lib/db/orderItemReturns"
import {
  listReturnableOrderLines,
  purchaseOrderItemReturnLabel,
  quoteOrderItemReturnRates,
} from "@/lib/services/issueOrderItemReturn"
import { adminOrderItemReturnPostBodySchema } from "@/lib/validations/order-item-return"

export const dynamic = "force-dynamic"

const orderIdSchema = z.string().uuid()

/**
 * GET /api/admin/orders/:id/returns
 * Lists returnable lines + existing returns for admin order detail.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = orderIdSchema.safeParse((await context.params).id)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const listed = await listReturnableOrderLines(supabase, parsed.data)
  if ("error" in listed) {
    return NextResponse.json({ error: listed.error }, { status: listed.status })
  }

  const returns = await listOrderItemReturnsForOrder(supabase, parsed.data)

  return NextResponse.json({
    data: {
      orderStatus: listed.order.status,
      fulfillmentMethod: listed.order.fulfillment_method,
      lines: listed.lines,
      returns,
    },
  })
}

/**
 * POST /api/admin/orders/:id/returns
 * action=rates | purchase — authorize an item return and buy a prepaid return label.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsedId = orderIdSchema.safeParse((await context.params).id)
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminOrderItemReturnPostBodySchema.safeParse(body)
  if (!parsed.success) {
    const first =
      parsed.error.issues[0]?.message ??
      parsed.error.flatten().formErrors[0] ??
      "Invalid request"
    return NextResponse.json({ error: first }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const orderId = parsedId.data

  if (parsed.data.action === "rates") {
    const result = await quoteOrderItemReturnRates({
      supabase,
      orderId,
      orderItemId: parsed.data.order_item_id,
      listingId: parsed.data.listing_id,
      parcel: parsed.data.parcel,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({
      data: {
        line: result.line,
        rates: result.rates,
        shipFromSummary: result.shipFromSummary,
        shipToSummary: result.shipToSummary,
        refundAmountUsd: result.refundAmountUsd,
        sellerClawbackUsd: result.sellerClawbackUsd,
      },
    })
  }

  const purchased = await purchaseOrderItemReturnLabel({
    supabase,
    orderId,
    adminProfileId: gate.ctx.user.id,
    orderItemId: parsed.data.order_item_id,
    listingId: parsed.data.listing_id,
    rateId: parsed.data.rate_id,
  })

  if (!purchased.ok) {
    return NextResponse.json({ error: purchased.error }, { status: purchased.status })
  }

  return NextResponse.json({
    data: {
      return: purchased.returnRow,
      alreadyPurchased: purchased.alreadyPurchased,
    },
  })
}
