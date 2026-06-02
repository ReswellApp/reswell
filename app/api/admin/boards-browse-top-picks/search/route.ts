import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { adminBoardsBrowseTopPickSearchQuerySchema } from "@/lib/validations/boards-browse-top-picks"
import { searchBoardsBrowseTopPickPickerService } from "@/lib/services/boardsBrowseTopPicks"

export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const sp = request.nextUrl.searchParams
  const parsedQuery = adminBoardsBrowseTopPickSearchQuerySchema.safeParse({
    q: sp.get("q") ?? "",
    limit: sp.get("limit") ?? undefined,
  })
  if (!parsedQuery.success) {
    const msg = parsedQuery.error.flatten().formErrors.join(", ") || "Invalid query"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await searchBoardsBrowseTopPickPickerService(
    gate.ctx.supabase,
    parsedQuery.data.q,
    parsedQuery.data.limit,
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: { hits: result.hits } }, { status: 200 })
}
