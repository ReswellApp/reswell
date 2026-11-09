import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  aggregateSurfboardDimensionPhotoMatchStats,
  listSurfboardDimensionPhotoMatches,
} from "@/lib/db/surfboardDimensionPhoto"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { surfboardDimensionPhotoMatchListQuerySchema } from "@/lib/validations/surfboardDimensionPhoto"

function loadError(message: string): string {
  if (/does not exist|schema cache|relation/i.test(message)) {
    return "Dimension photo tables are missing. Apply migrations 20271201120000 and 20271201130000, then refresh."
  }
  return "Could not load dimension photo matches"
}

export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = surfboardDimensionPhotoMatchListQuerySchema.safeParse(
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
    listSurfboardDimensionPhotoMatches(service, {
      fromIso,
      rating: parsed.data.rating,
      surface: parsed.data.surface,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    }),
    aggregateSurfboardDimensionPhotoMatchStats(service, fromIso),
  ])

  if (list.error) {
    return NextResponse.json({ error: loadError(list.error.message) }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      matches: list.data,
      total: list.total,
      stats,
      days: parsed.data.days,
    },
  })
}
