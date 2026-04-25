import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  adminBrandModelVariantCreateBodySchema,
  adminBrandModelVariantsListQuerySchema,
} from "@/lib/validations/brand-model-variants"
import {
  createBrandModelVariantService,
  listBrandModelVariantsAdminService,
} from "@/lib/services/brandModelVariants"

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const sp = req.nextUrl.searchParams
  const parsed = adminBrandModelVariantsListQuerySchema.safeParse({
    brand_model_id: sp.get("brand_model_id") ?? undefined,
  })
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid query"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const result = await listBrandModelVariantsAdminService(gate.ctx.supabase, parsed.data.brand_model_id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ data: { rows: result.rows } }, { status: 200 })
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminBrandModelVariantCreateBodySchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const imageUrl = parsed.data.image_url ?? null
  const result = await createBrandModelVariantService(gate.ctx.supabase, {
    brand_model_id: parsed.data.brand_model_id,
    brand_id: parsed.data.brand_id,
    length_label: parsed.data.length_label,
    width_label: parsed.data.width_label,
    thickness_label: parsed.data.thickness_label,
    volume_label: parsed.data.volume_label,
    fin_box_type: parsed.data.fin_box_type,
    image_url: imageUrl,
    sort_order: parsed.data.sort_order,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json({ data: { variant: result.row } }, { status: 201 })
}
