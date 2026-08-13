import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { applySearchDailyReportSynonym } from "@/lib/services/searchDailyReport"
import { applySearchPeriodReportSynonym } from "@/lib/services/searchPeriodReport"
import { searchDailyReportApplySynonymSchema } from "@/lib/validations/search-daily-report"

export const dynamic = "force-dynamic"

/**
 * POST /api/admin/search-daily-report/synonyms
 * Body: { date, query } or { periodKind, periodKey, query }
 * Writes a catalog-validated synonym for that empty-search query.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = searchDailyReportApplySynonymSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  try {
    if (parsed.data.date) {
      const result = await applySearchDailyReportSynonym({
        date: parsed.data.date,
        query: parsed.data.query,
        createdBy: gate.ctx.user.id,
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({ data: { report: result.row } }, { status: 200 })
    }

    if (!parsed.data.periodKind || !parsed.data.periodKey) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }

    const result = await applySearchPeriodReportSynonym({
      kind: parsed.data.periodKind,
      key: parsed.data.periodKey,
      query: parsed.data.query,
      createdBy: gate.ctx.user.id,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ data: { report: result.row } }, { status: 200 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[admin/search-daily-report/synonyms]", msg)
    return NextResponse.json({ error: "Could not add synonym" }, { status: 500 })
  }
}
