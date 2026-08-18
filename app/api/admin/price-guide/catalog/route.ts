import { NextRequest, NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { priceGuideCatalogQuerySchema } from "@/lib/validations/price-guide"
import { searchPriceGuideAdminCatalog } from "@/lib/services/priceGuideAdmin"

export async function GET(req: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const parsed = priceGuideCatalogQuerySchema.safeParse({
    q: req.nextUrl.searchParams.get("q") ?? "",
    category_slug: req.nextUrl.searchParams.get("category_slug") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  const data = await searchPriceGuideAdminCatalog(gate.ctx.supabase, parsed.data.q)
  return NextResponse.json({ data }, { status: 200 })
}
