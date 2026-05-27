import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { listBrandCatalogImagesPickerService } from "@/lib/services/brandCatalogImages"
import { adminBrandCatalogImagesQuerySchema } from "@/lib/validations/brand-catalog-images"

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const sp = req.nextUrl.searchParams
  const parsed = adminBrandCatalogImagesQuerySchema.safeParse({
    brand_id: sp.get("brand_id") ?? undefined,
    focus_brand_model_id: sp.get("focus_brand_model_id") || null,
    source: sp.get("source") || "catalog",
  })
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid query"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const result = await listBrandCatalogImagesPickerService(gate.ctx.supabase, {
    brand_id: parsed.data.brand_id,
    focus_brand_model_id: parsed.data.focus_brand_model_id ?? null,
    source: parsed.data.source,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: { items: result.items } }, { status: 200 })
}
