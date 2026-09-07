import { NextRequest, NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { isPriceGuideCategorySlug } from "@/lib/price-guide/categories"
import { getPriceGuideCoverage } from "@/lib/services/priceGuideAdmin"

export async function GET(req: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const raw = req.nextUrl.searchParams.get("category_slug") ?? "surfboards"
  if (!isPriceGuideCategorySlug(raw)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }

  const rows = await getPriceGuideCoverage(gate.ctx.supabase, raw)
  return NextResponse.json({ data: { rows } }, { status: 200 })
}
