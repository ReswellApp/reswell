import { createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  loadAdminUserLabelContext,
  purchaseAdminUserShippingLabel,
  quoteAdminUserShippingLabelRates,
} from "@/lib/services/adminUserShippingLabel"
import {
  adminUserShippingLabelPostBodySchema,
  adminUserShippingLabelQuerySchema,
} from "@/lib/validations/adminUserShippingLabel"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/shipping/user-label?user_id=
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  const parsed = adminUserShippingLabelQuerySchema.safeParse({
    user_id: request.nextUrl.searchParams.get("user_id"),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const result = await loadAdminUserLabelContext(supabase, parsed.data.user_id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ data: result.data })
}

/**
 * POST /api/admin/shipping/user-label
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminUserShippingLabelPostBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  if (parsed.data.action === "rates") {
    const quoted = await quoteAdminUserShippingLabelRates({
      supabase,
      userId: parsed.data.user_id,
      parcel: parsed.data.parcel,
      shipTo: parsed.data.ship_to,
    })
    if (!quoted.ok) {
      return NextResponse.json({ error: quoted.error }, { status: quoted.status })
    }
    return NextResponse.json({ data: { rates: quoted.rates } })
  }

  const purchased = await purchaseAdminUserShippingLabel({
    supabase,
    staffUserId: gate.ctx.user.id,
    userId: parsed.data.user_id,
    rateId: parsed.data.rate_id,
    parcel: parsed.data.parcel,
    shipTo: parsed.data.ship_to,
  })
  if (!purchased.ok) {
    return NextResponse.json({ error: purchased.error }, { status: purchased.status })
  }

  return NextResponse.json({
    data: {
      labelUrl: purchased.labelUrl,
      trackingNumber: purchased.trackingNumber,
      trackingCarrier: purchased.trackingCarrier,
      costUsd: purchased.costUsd,
      carrierLabel: purchased.carrierLabel,
      conversationId: purchased.conversationId,
      messageSent: purchased.messageSent,
    },
  })
}
