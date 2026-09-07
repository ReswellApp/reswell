import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { adminBrandModelPatchBodySchema } from "@/lib/validations/brand-models"
import { deleteBrandModelService, updateBrandModelService } from "@/lib/services/brandModels"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminBrandModelPatchBodySchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const body = parsed.data
  if (
    body.name === undefined &&
    body.description === undefined &&
    body.brand_id === undefined &&
    body.image_url === undefined &&
    body.board_category_slug === undefined
  ) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const result = await updateBrandModelService(gate.ctx.supabase, id, {
    name: body.name,
    description: body.description,
    brand_id: body.brand_id,
    image_url: body.image_url,
    board_category_slug: body.board_category_slug,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const result = await deleteBrandModelService(gate.ctx.supabase, id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}
