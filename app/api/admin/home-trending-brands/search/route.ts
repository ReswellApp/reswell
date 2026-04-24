import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { adminHomeTrendingBrandSearchQuerySchema } from "@/lib/validations/home-trending-brands"
import { searchTrendingBrandsPickerService } from "@/lib/services/homeTrendingBrands"

export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = adminHomeTrendingBrandSearchQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  })
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid query"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const result = await searchTrendingBrandsPickerService(
    gate.ctx.supabase,
    parsed.data.q,
    parsed.data.limit,
  )
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ data: { hits: result.hits } }, { status: 200 })
}
