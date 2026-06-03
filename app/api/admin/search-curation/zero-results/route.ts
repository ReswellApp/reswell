import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { getSearchAnalyticsDashboardService } from "@/lib/services/searchAnalytics"
import {
  brandCatalogTypoDistance,
  pickClosestBrandNameMatch,
} from "@/lib/utils/marketplace-brand-query"
import { listSearchSynonyms } from "@/lib/db/searchCuration"
import { normalizeSearchCurationKey } from "@/lib/validations/searchCuration"

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(30),
})

export type ZeroResultQueryRow = {
  query: string
  count: number
  suggestedBrand: { name: string; slug: string | null; distance: number } | null
  hasSynonym: boolean
  hasOverride: boolean
}

export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  const supabase = gate.ctx.supabase

  const [dashboard, brandsRes, synonymsRes, overridesRes] = await Promise.all([
    getSearchAnalyticsDashboardService(parsed.data.days),
    supabase.from("brands").select("name, slug"),
    listSearchSynonyms(supabase),
    supabase.from("search_result_overrides").select("query_normalized"),
  ])

  const brands = (brandsRes.data ?? []) as { name: string; slug: string | null }[]
  const synonymTerms = new Set(
    (synonymsRes.data ?? []).map((s) => normalizeSearchCurationKey(s.term)),
  )
  const overrideQueries = new Set(
    ((overridesRes.data ?? []) as { query_normalized: string }[]).map((o) =>
      normalizeSearchCurationKey(o.query_normalized),
    ),
  )

  const rows: ZeroResultQueryRow[] = dashboard.zeroResultQueries.map(({ query, count }) => {
    const normalized = normalizeSearchCurationKey(query)
    const match = pickClosestBrandNameMatch(
      brands.map((b) => ({ name: b.name, slug: b.slug ?? undefined })),
      query,
    )
    let suggestedBrand: ZeroResultQueryRow["suggestedBrand"] = null
    if (match) {
      const distance = brandCatalogTypoDistance(query, match)
      // Only surface as a likely misspelling when it isn't an exact match already.
      if (distance > 0) {
        suggestedBrand = { name: match.name, slug: match.slug ?? null, distance }
      }
    }
    return {
      query,
      count,
      suggestedBrand,
      hasSynonym: synonymTerms.has(normalized),
      hasOverride: overrideQueries.has(normalized),
    }
  })

  return NextResponse.json(
    { data: { days: parsed.data.days, configured: dashboard.configured, rows } },
    { status: 200 },
  )
}
