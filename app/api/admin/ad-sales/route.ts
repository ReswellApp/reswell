import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { getAdAttributedSalesDashboard } from "@/lib/services/adAttributedSales"
import { adAttributedSalesQuerySchema } from "@/lib/validations/adAttributedSales"

export const dynamic = "force-dynamic"

/**
 * GA4 item purchases attributed to Google Ads or Meta, joined to Reswell listings/orders.
 * GET /api/admin/ad-sales?days=28
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = adAttributedSalesQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  try {
    const data = await getAdAttributedSalesDashboard({ days: parsed.data.days })
    return NextResponse.json({ data }, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[admin/ad-sales]", message)
    return NextResponse.json({ error: "Could not load ad sales data" }, { status: 500 })
  }
}
