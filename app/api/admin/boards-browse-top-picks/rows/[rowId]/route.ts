import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { deleteBoardsBrowseTopPickService } from "@/lib/services/boardsBrowseTopPicks"

const ROW_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ rowId: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { rowId: rawRowId } = await ctx.params
  const rowId = typeof rawRowId === "string" ? decodeURIComponent(rawRowId.trim()) : ""
  if (!rowId || !ROW_UUID_RE.test(rowId)) {
    return NextResponse.json({ error: "Invalid row id" }, { status: 400 })
  }

  const result = await deleteBoardsBrowseTopPickService(rowId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  revalidateBoardsBrowseCatalog()
  return NextResponse.json({ data: { deleted: true } }, { status: 200 })
}
