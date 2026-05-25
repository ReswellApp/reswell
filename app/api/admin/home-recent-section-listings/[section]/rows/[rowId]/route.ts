import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { revalidateHomePublicCatalog } from "@/lib/cache/revalidate-home-public-catalog"
import {
  adminHomeRecentSectionParamSchema,
  homeRecentSectionKeyFromParam,
} from "@/lib/validations/home-recent-section-listings"
import { deleteHomeRecentSectionListingService } from "@/lib/services/homeRecentSectionListings"

const ROW_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ section: string; rowId: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { section: rawSection, rowId: rawRowId } = await ctx.params
  const parsedParam = adminHomeRecentSectionParamSchema.safeParse(rawSection)
  if (!parsedParam.success) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 })
  }

  const rowId = typeof rawRowId === "string" ? decodeURIComponent(rawRowId.trim()) : ""
  if (!rowId || !ROW_UUID_RE.test(rowId)) {
    return NextResponse.json({ error: "Invalid row id" }, { status: 400 })
  }

  const key = homeRecentSectionKeyFromParam(parsedParam.data)
  const result = await deleteHomeRecentSectionListingService(key, rowId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  revalidateHomePublicCatalog()
  return NextResponse.json({ data: { deleted: true } }, { status: 200 })
}
