import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { revalidateHomePublicCatalog } from "@/lib/cache/revalidate-home-public-catalog"
import { deleteHomeTrendingBrandService } from "@/lib/services/homeTrendingBrands"

const ROW_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id: raw } = await ctx.params
  const id = typeof raw === "string" ? decodeURIComponent(raw.trim()) : ""
  if (!id || !ROW_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid trending row id" }, { status: 400 })
  }

  const result = await deleteHomeTrendingBrandService(id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  revalidateHomePublicCatalog()
  return NextResponse.json({ data: { deleted: true } }, { status: 200 })
}
