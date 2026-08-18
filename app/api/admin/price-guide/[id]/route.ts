import { NextRequest, NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { priceGuideEntryUpdateSchema } from "@/lib/validations/price-guide"
import {
  deletePriceGuideEntryService,
  getPriceGuideAdminDetail,
  updatePriceGuideEntryService,
} from "@/lib/services/priceGuideAdmin"

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const detail = await getPriceGuideAdminDetail(gate.ctx.supabase, id)
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: detail }, { status: 200 })
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = priceGuideEntryUpdateSchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const result = await updatePriceGuideEntryService(
    gate.ctx.supabase,
    id,
    parsed.data,
    gate.ctx.user.id,
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ data: { entry: result.row } }, { status: 200 })
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const result = await deletePriceGuideEntryService(gate.ctx.supabase, id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}
