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
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  const hits = await searchSurfboardsForBoardsBrowseAdmin(
    gate.ctx.supabase,
    parsed.data.q ?? "",
    parsed.data.limit ?? 20,
  )

  return NextResponse.json({ data: { hits } }, { status: 200 })
}
