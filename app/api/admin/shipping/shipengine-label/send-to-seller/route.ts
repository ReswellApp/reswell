import { createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { sendFetchedShipengineLabelPdfToSeller } from "@/lib/services/sendFetchedShipengineLabelToSeller"
import { shipengineLabelSendBodySchema } from "@/lib/validations/shipengine-label-send"

export const dynamic = "force-dynamic"

/**
 * POST /api/admin/shipping/shipengine-label/send-to-seller
 *
 * Re-resolves label PDF from ShipEngine (same ids as GET shipengine-label), downloads server-side,
 * stores in order-shipping-labels, posts to buyer–seller thread (same path as manual PDF upload).
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = shipengineLabelSendBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors.join("; ") || "Invalid body" },
      { status: 400 },
    )
  }

  const body = parsed.data
  const supabase = createServiceRoleClient()

  const result = await sendFetchedShipengineLabelPdfToSeller({
    supabase,
    adminUserId: gate.ctx.user.id,
    shipmentId: body.shipment_id,
    labelId: body.label_id,
    explicitOrderId: body.order_id ?? null,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true })
}
