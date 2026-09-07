import { NextRequest, NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import {
  aggregateSearchQualityStats,
  listSearchQualityEvents,
} from "@/lib/db/searchQuality"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { searchQualityListQuerySchema } from "@/lib/validations/searchQuality"

function searchQualityLoadError(message: string): string {
  if (/does not exist|schema cache|relation/i.test(message)) {
    return "Search quality table is missing. Apply migration 20270822120000_search_quality_reviews.sql, then refresh."
  }
  return "Could not load search results"
}

export async function GET(request: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const parsed = searchQualityListQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    )
  }

  const fromIso = new Date(
    Date.now() - parsed.data.days * 24 * 60 * 60 * 1000,
  ).toISOString()

  const [list, stats] = await Promise.all([
    listSearchQualityEvents(service, {
      fromIso,
      rating: parsed.data.rating,
      query: parsed.data.q,
      llmOnly: parsed.data.llmOnly,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    }),
    aggregateSearchQualityStats(service, fromIso),
  ])

  if (list.error) {
    return NextResponse.json({ error: searchQualityLoadError(list.error.message) }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      events: list.data,
      total: list.total,
      stats,
      days: parsed.data.days,
    },
  })
}
