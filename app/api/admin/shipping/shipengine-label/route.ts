import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  fetchLabelById,
  fetchLabelDownloadsForShipment,
} from "@/lib/shipengine/label-lookup"
import { shipengineLabelLookupQuerySchema } from "@/lib/validations/shipengine-label-lookup"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/shipping/shipengine-label?shipment_id=se-…
 * GET /api/admin/shipping/shipengine-label?label_id=se-…
 *
 * Resolves label PDF/PNG/ZPL download URLs via ShipEngine (same API key as checkout).
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = shipengineLabelLookupQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors.join("; ") || "Invalid query" },
      { status: 400 },
    )
  }

  const q = parsed.data
  if (q.label_id) {
    const r = await fetchLabelById(q.label_id)
    if (!r.ok) {
      return NextResponse.json({ error: r.error }, { status: r.status })
    }
    return NextResponse.json({ data: { ...r.label, listCount: null as number | null } })
  }

  const r = await fetchLabelDownloadsForShipment(q.shipment_id!)
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: r.status })
  }

  return NextResponse.json({
    data: {
      ...r.label,
      listCount: r.listCount,
    },
  })
}
