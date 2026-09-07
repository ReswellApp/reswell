import { NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { priceGuideCompCreateSchema } from "@/lib/validations/price-guide"
import { addPriceGuideCompService } from "@/lib/services/priceGuideAdmin"

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(request: Request, ctx: RouteCtx) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = priceGuideCompCreateSchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const result = await addPriceGuideCompService(gate.ctx.supabase, id, {
    ...parsed.data,
    created_by: gate.ctx.user.id,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ data: { comp: result.row } }, { status: 201 })
}
