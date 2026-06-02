import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { adminBoardsBrowseSuppressedSearchQuerySchema } from "@/lib/validations/listing-boards-browse-suppression"
import { searchSurfboardsForBoardsBrowseAdmin } from "@/lib/db/boards-browse-suppressed-admin"

export async function GET(request: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const url = new URL(request.url)
  const parsed = adminBoardsBrowseSuppressedSearchQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  const { hits, total } = await searchSurfboardsForBoardsBrowseAdmin(
    gate.ctx.supabase,
    parsed.data.q ?? "",
    {
      limit: parsed.data.limit ?? 50,
      offset: parsed.data.offset ?? 0,
    },
  )

  return NextResponse.json({ data: { hits, total } }, { status: 200 })
}
