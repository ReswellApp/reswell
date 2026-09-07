import { NextRequest, NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { pacificYearMonth, previousPacificYearMonth } from "@/lib/services/searchDailyReport"
import {
  getSearchPeriodReportService,
  listSearchPeriodReportsService,
  resolveSearchPeriodKey,
  runSearchPeriodReport,
  toSearchPeriodReportIndexItem,
} from "@/lib/services/searchPeriodReport"
import {
  SEARCH_PERIOD_ALL_TIME_KEY,
  searchPeriodReportGenerateSchema,
  searchPeriodReportQuerySchema,
} from "@/lib/validations/search-daily-report"

export const maxDuration = 300
export const dynamic = "force-dynamic"

/**
 * GET /api/admin/search-period-report?kind=month&key=YYYY-MM
 * GET /api/admin/search-period-report?kind=all_time
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const parsed = searchPeriodReportQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  try {
    const kind = parsed.data.kind
    const defaultMonth = previousPacificYearMonth()
    const currentMonth = pacificYearMonth()
    const [monthRows, allTimeRow] = await Promise.all([
      listSearchPeriodReportsService("month", parsed.data.limit),
      getSearchPeriodReportService("all_time", SEARCH_PERIOD_ALL_TIME_KEY),
    ])
    const months = monthRows.map(toSearchPeriodReportIndexItem)
    const allTime = allTimeRow ? toSearchPeriodReportIndexItem(allTimeRow) : null

    let report = null
    if (kind === "all_time") {
      report = allTimeRow
    } else if (parsed.data.key) {
      const key = resolveSearchPeriodKey("month", parsed.data.key)
      report = monthRows.find((r) => r.period_key === key) ?? (await getSearchPeriodReportService("month", key))
    }

    return NextResponse.json({
      data: {
        defaultMonth,
        currentMonth,
        months,
        allTime,
        report,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[admin/search-period-report] GET:", msg)
    return NextResponse.json({ error: "Could not load period report" }, { status: 500 })
  }
}

/**
 * POST /api/admin/search-period-report
 * Body: { kind: "month" | "all_time", key?: string, force?: boolean }
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

  const parsed = searchPeriodReportGenerateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  try {
    const summary = await runSearchPeriodReport({
      kind: parsed.data.kind,
      key: parsed.data.key,
      force: parsed.data.force,
      notify: false,
    })
    return NextResponse.json({ data: summary }, { status: 200 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[admin/search-period-report] POST:", msg)
    return NextResponse.json({ error: "Could not generate period report" }, { status: 500 })
  }
}
