import { NextRequest, NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { lookupSearchQueryAllTimeService } from "@/lib/services/searchAnalytics"
import { searchQueryLookupSchema } from "@/lib/validations/search-analytics"

/**
 * GET /api/admin/search-analytics/query-lookup?q=firewire
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const parsed = searchQueryLookupSchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a search query" }, { status: 400 })
  }

  const data = await lookupSearchQueryAllTimeService(parsed.data.q)
  return NextResponse.json({ data }, { status: 200 })
}
