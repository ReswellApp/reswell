import { NextRequest, NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { deletePriceGuideCompService } from "@/lib/services/priceGuideAdmin"

type RouteCtx = { params: Promise<{ compId: string }> }

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const { compId } = await ctx.params
  const result = await deletePriceGuideCompService(gate.ctx.supabase, compId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}
