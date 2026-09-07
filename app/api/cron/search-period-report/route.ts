import { NextResponse } from "next/server"
import { previousPacificYearMonth } from "@/lib/services/searchDailyReport"
import { runSearchPeriodReport } from "@/lib/services/searchPeriodReport"

export const maxDuration = 300

/**
 * Monthly + all-time Gemini search briefings. Writes to `search_period_reports`
 * and optionally emails ADMIN_DIGEST_EMAILS. Protected with CRON_SECRET.
 *
 * Default: previous Pacific month + refresh all-time history.
 * `?kind=month|all_time` to run one; `?key=YYYY-MM` for a month; `?force=1`.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const kindParam = url.searchParams.get("kind")
  const keyParam = url.searchParams.get("key")
  const force = url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true"
  const monthKey =
    keyParam && /^\d{4}-\d{2}$/.test(keyParam) ? keyParam : previousPacificYearMonth()

  try {
    if (kindParam === "month") {
      const monthly = await runSearchPeriodReport({ kind: "month", key: monthKey, force, notify: true })
      return NextResponse.json({ monthly, reference_time: new Date().toISOString() })
    }
    if (kindParam === "all_time") {
      const allTime = await runSearchPeriodReport({ kind: "all_time", force: true, notify: true })
      return NextResponse.json({ allTime, reference_time: new Date().toISOString() })
    }

    const monthly = await runSearchPeriodReport({
      kind: "month",
      key: monthKey,
      force,
      notify: true,
    })
    const allTime = await runSearchPeriodReport({
      kind: "all_time",
      force: true,
      notify: true,
    })
    return NextResponse.json({
      monthly,
      allTime,
      reference_time: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] search-period-report failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
