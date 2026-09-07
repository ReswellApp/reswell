import { NextResponse } from "next/server"
import {
  previousPacificCalendarDate,
  runSearchDailyReport,
} from "@/lib/services/searchDailyReport"

export const maxDuration = 120

/**
 * Daily Gemini briefing of marketplace searches, dropdown picks, and zero-result
 * queries. Writes to `search_daily_reports` and optionally emails ADMIN_DIGEST_EMAILS
 * via Klaviyo ("Search Daily Report"). Protected with CRON_SECRET.
 *
 * Default target: previous complete Pacific calendar day.
 * `?date=YYYY-MM-DD` to generate a specific day; `?force=1` to regenerate.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const dateParam = url.searchParams.get("date")
  const force = url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true"
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : previousPacificCalendarDate()

  try {
    const summary = await runSearchDailyReport({ date, force, notify: true })
    return NextResponse.json({ summary, reference_time: new Date().toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] search-daily-report failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
