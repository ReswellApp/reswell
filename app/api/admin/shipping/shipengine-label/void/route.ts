import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { voidShipEngineLabelForOrder } from "@/lib/services/voidShipEngineLabelForOrder"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { shipengineLabelVoidBodySchema } from "@/lib/validations/shipengine-label-void"

export const dynamic = "force-dynamic"

/**
 * POST /api/admin/shipping/shipengine-label/void
 *
 * Voids a ShipEngine label linked to an order and requests refund to ShipEngine balance (carrier-dependent).
 * Body: { order_id, label_id? } — when label_id is omitted, uses the order’s saved tracking to find the newest non-voided label.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = shipengineLabelVoidBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("[shipengine-label void] service role:", e)
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const result = await voidShipEngineLabelForOrder({
    supabase,
    orderId: parsed.data.order_id,
    explicitLabelId: parsed.data.label_id ?? null,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ data: result.data })
}
