import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { cleanupStaleBoardsBrowseTopPicksService } from "@/lib/services/boardsBrowseTopPicks"

export async function POST() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const result = await cleanupStaleBoardsBrowseTopPicksService()
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  if (result.removed > 0) {
    revalidateBoardsBrowseCatalog()
  }

  return NextResponse.json({ data: { removed: result.removed } }, { status: 200 })
}
