import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { searchPartnerEmbedPickerService } from "@/lib/services/partnerListingEmbeds"

type RouteContext = { params: Promise<{ embedId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { embedId } = await context.params
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "20")
  const limit = Number.isFinite(limitRaw) ? limitRaw : 20

  const result = await searchPartnerEmbedPickerService(gate.ctx.supabase, embedId, q, limit)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: { hits: result.hits } }, { status: 200 })
}
