import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { searchListingsForAdminTerminal } from "@/lib/db/adminTerminalListings"
import { adminTerminalListingSearchQuerySchema } from "@/lib/validations/adminTerminalSale"

export const dynamic = "force-dynamic"

/** GET /api/admin/terminal/listings/search?q=… */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  const parsed = adminTerminalListingSearchQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  })
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid query"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const hits = await searchListingsForAdminTerminal(
    gate.ctx.supabase,
    parsed.data.q,
    parsed.data.limit,
  )

  return NextResponse.json({ data: { hits } })
}
