import { NextRequest, NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import {
  getSearchDailyReportService,
  listSearchDailyReportsService,
  pacificCalendarDate,
  previousPacificCalendarDate,
  runSearchDailyReport,
  toSearchDailyReportIndexItem,
} from "@/lib/services/searchDailyReport"
import {
  searchDailyReportGenerateSchema,
  searchDailyReportQuerySchema,
} from "@/lib/validations/search-daily-report"

export const maxDuration = 120
export const dynamic = "force-dynamic"

/**
 * GET /api/admin/search-daily-report?date=YYYY-MM-DD
 * GET /api/admin/search-daily-report  → recent reports + default date
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const parsed = searchDailyReportQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  try {
    const defaultDate = previousPacificCalendarDate()
    const todayPacific = pacificCalendarDate()
    const rows = await listSearchDailyReportsService(parsed.data.limit)
    const days = rows.map(toSearchDailyReportIndexItem)
    const requestedDate = parsed.data.date
    const fromList = requestedDate
      ? rows.find((r) => r.report_date === requestedDate) ?? null
      : null
    const report =
      requestedDate == null
        ? null
        : fromList ?? (await getSearchDailyReportService(requestedDate))

    return NextResponse.json({
      data: {
        defaultDate,
        todayPacific,
        days,
        report,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[admin/search-daily-report] GET:", msg)
    return NextResponse.json({ error: "Could not load daily report" }, { status: 500 })
  }
}

/**
 * POST /api/admin/search-daily-report
 * Body: { date?: "YYYY-MM-DD", force?: boolean }
 * Runs Gemini against that Pacific day's search events and upserts the report.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = searchDailyReportGenerateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const date = parsed.data.date ?? previousPacificCalendarDate()

  try {
    const summary = await runSearchDailyReport({
      date,
      force: parsed.data.force,
      notify: false,
    })
    return NextResponse.json({ data: summary }, { status: 200 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[admin/search-daily-report] POST:", msg)
    return NextResponse.json({ error: "Could not generate daily report" }, { status: 500 })
  }
}
