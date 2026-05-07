import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  adminHomeRecentSectionParamSchema,
  adminHomeRecentSectionSearchQuerySchema,
  homeRecentSectionKeyFromParam,
} from "@/lib/validations/home-recent-section-listings"
import { searchHomeRecentSectionPickerService } from "@/lib/services/homeRecentSectionListings"

export async function GET(request: NextRequest, ctx: { params: Promise<{ section: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { section: raw } = await ctx.params
  const parsedParam = adminHomeRecentSectionParamSchema.safeParse(raw)
  if (!parsedParam.success) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 })
  }

  const sp = request.nextUrl.searchParams
  const parsedQuery = adminHomeRecentSectionSearchQuerySchema.safeParse({
    q: sp.get("q") ?? "",
    limit: sp.get("limit") ?? undefined,
  })
  if (!parsedQuery.success) {
    const msg = parsedQuery.error.flatten().formErrors.join(", ") || "Invalid query"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const key = homeRecentSectionKeyFromParam(parsedParam.data)
  const result = await searchHomeRecentSectionPickerService(
    gate.ctx.supabase,
    key,
    parsedQuery.data.q,
    parsedQuery.data.limit,
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: { hits: result.hits } }, { status: 200 })
}
