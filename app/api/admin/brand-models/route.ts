import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { adminBrandModelCreateBodySchema, adminBrandModelsListQuerySchema } from "@/lib/validations/brand-models"
import { createBrandModelService, listBrandModelsAdminService } from "@/lib/services/brandModels"

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const sp = req.nextUrl.searchParams
  const parsed = adminBrandModelsListQuerySchema.safeParse({
    brand_id: sp.get("brand_id") ?? undefined,
  })
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid query"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const result = await listBrandModelsAdminService(gate.ctx.supabase, parsed.data.brand_id)
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

  const parsed = adminBrandModelCreateBodySchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const desc = parsed.data.description ?? null
  const imageUrl = parsed.data.image_url ?? null
  const result = await createBrandModelService(gate.ctx.supabase, {
    brand_id: parsed.data.brand_id,
    name: parsed.data.name,
    description: desc,
    image_url: imageUrl,
    product_category_slug: parsed.data.product_category_slug,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json({ data: { model: result.row } }, { status: 201 })
}
