import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { adminBrandModelVariantPatchBodySchema } from "@/lib/validations/brand-model-variants"
import {
  deleteBrandModelVariantService,
  updateBrandModelVariantService,
} from "@/lib/services/brandModelVariants"

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

  const parsed = adminBrandModelVariantPatchBodySchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const body = parsed.data
  if (
    body.length_label === undefined &&
    body.width_label === undefined &&
    body.thickness_label === undefined &&
    body.volume_label === undefined &&
    body.fin_box_type === undefined &&
    body.fin_boxes === undefined &&
    body.material === undefined &&
    body.condition === undefined &&
    body.fin_size === undefined &&
    body.configuration_label === undefined &&
    body.fin_base_label === undefined &&
    body.fin_height_label === undefined &&
    body.fin_foil_label === undefined &&
    body.fin_color_label === undefined &&
    body.product_category_slug === undefined &&
    body.price === undefined &&
    body.image_url === undefined &&
    body.sort_order === undefined
  ) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const result = await updateBrandModelVariantService(gate.ctx.supabase, id, {
    length_label: body.length_label,
    width_label: body.width_label,
    thickness_label: body.thickness_label,
    volume_label: body.volume_label,
    fin_box_type: body.fin_box_type,
    fin_boxes: body.fin_boxes,
    material: body.material,
    condition: body.condition,
    fin_size: body.fin_size,
    configuration_label: body.configuration_label,
    fin_base_label: body.fin_base_label,
    fin_height_label: body.fin_height_label,
    fin_foil_label: body.fin_foil_label,
    fin_color_label: body.fin_color_label,
    product_category_slug: body.product_category_slug,
    price: body.price,
    image_url: body.image_url,
    sort_order: body.sort_order,
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

  const result = await deleteBrandModelVariantService(gate.ctx.supabase, id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}
