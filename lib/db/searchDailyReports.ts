import type { SupabaseClient } from "@supabase/supabase-js"
import type { SearchDailyLlmReport } from "@/lib/validations/search-daily-report"

export type SearchDailyReportStatus = "generating" | "complete" | "failed" | "empty"

export type SearchDailyReportSnapshot = {
  totalSearches: number
  uniqueQueriesApprox: number
  zeroResultEventCount: number
  zeroResultShare: number | null
  avgResultCount: number | null
  dropdownClicks: number
  dropdownHovers: number
  navFreeFormSubmits: number
  navDropdownSelections: number
  brandDirectorySearches: number
  brandDirectoryZeroResults: number
  demandCaptureTotal: number
  eventSampleCount: number
}

export type SearchDailyReportRow = {
  id: string
  report_date: string
  generated_at: string
  model: string
  status: SearchDailyReportStatus
  from_iso: string
  to_iso: string
  snapshot: SearchDailyReportSnapshot
  report: SearchDailyLlmReport | null
  error: string | null
  created_at: string
  updated_at: string
}

const COLUMNS =
  "id, report_date, generated_at, model, status, from_iso, to_iso, snapshot, report, error, created_at, updated_at"

function asRow(raw: unknown): SearchDailyReportRow | null {
  if (!raw || typeof raw !== "object") return null
  return raw as SearchDailyReportRow
}

export async function getSearchDailyReportByDate(
  supabase: SupabaseClient,
  reportDate: string,
): Promise<{ row: SearchDailyReportRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("search_daily_reports")
    .select(COLUMNS)
    .eq("report_date", reportDate)
    .maybeSingle()

  if (error) return { row: null, error: new Error(error.message) }
  return { row: asRow(data), error: null }
}

export async function listSearchDailyReports(
  supabase: SupabaseClient,
  limit: number,
): Promise<{ rows: SearchDailyReportRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("search_daily_reports")
    .select(COLUMNS)
    .order("report_date", { ascending: false })
    .limit(limit)

  if (error) return { rows: [], error: new Error(error.message) }
  return { rows: (data ?? []) as SearchDailyReportRow[], error: null }
}

export type UpsertSearchDailyReportInput = {
  reportDate: string
  generatedAt: string
  model: string
  status: SearchDailyReportStatus
  fromIso: string
  toIso: string
  snapshot: SearchDailyReportSnapshot
  report: SearchDailyLlmReport | null
  error: string | null
}

export async function upsertSearchDailyReport(
  supabase: SupabaseClient,
  input: UpsertSearchDailyReportInput,
): Promise<{ row: SearchDailyReportRow | null; error: Error | null }> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("search_daily_reports")
    .upsert(
      {
        report_date: input.reportDate,
        generated_at: input.generatedAt,
        model: input.model,
        status: input.status,
        from_iso: input.fromIso,
        to_iso: input.toIso,
        snapshot: input.snapshot,
        report: input.report,
        error: input.error,
        updated_at: now,
      },
      { onConflict: "report_date" },
    )
    .select(COLUMNS)
    .maybeSingle()

  if (error) return { row: null, error: new Error(error.message) }
  return { row: asRow(data), error: null }
}
