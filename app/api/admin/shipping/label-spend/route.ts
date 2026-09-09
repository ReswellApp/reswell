import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { getAdminShipEngineLabelSpend } from "@/lib/services/adminShipEngineLabelSpend"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const querySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

/**
 * GET /api/admin/shipping/label-spend — ShipEngine-billed postage for a date range.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
  }

  const result = await getAdminShipEngineLabelSpend({
    dateFrom: parsed.data.date_from,
    dateTo: parsed.data.date_to,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }
  return NextResponse.json({ data: result.data })
}
