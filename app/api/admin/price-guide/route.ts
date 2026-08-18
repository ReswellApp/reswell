import { NextRequest, NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import {
  priceGuideAdminListQuerySchema,
  priceGuideEntryCreateSchema,
} from "@/lib/validations/price-guide"
import {
  createPriceGuideEntryService,
  listPriceGuideAdminEntries,
} from "@/lib/services/priceGuideAdmin"

export async function GET(req: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const sp = req.nextUrl.searchParams
  const parsed = priceGuideAdminListQuerySchema.safeParse({
    status: sp.get("status") ?? undefined,
    category_slug: sp.get("category_slug") ?? undefined,
    q: sp.get("q") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  const rows = await listPriceGuideAdminEntries(gate.ctx.supabase, {
    status: parsed.data.status,
    categorySlug: parsed.data.category_slug,
    q: parsed.data.q,
  })
  return NextResponse.json({ data: { rows } }, { status: 200 })
}

export async function POST(request: Request) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = priceGuideEntryCreateSchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const result = await createPriceGuideEntryService(gate.ctx.supabase, {
    category_slug: parsed.data.category_slug,
    brand_id: parsed.data.brand_id ?? null,
    brand_model_id: parsed.data.brand_model_id ?? null,
    created_by: gate.ctx.user.id,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }
  return NextResponse.json({ data: { entry: result.row } }, { status: 201 })
}
