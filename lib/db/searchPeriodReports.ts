import type { SupabaseClient } from "@supabase/supabase-js"
import type { SearchDailyReportSnapshot } from "@/lib/db/searchDailyReports"
import type { SearchPeriodLlmReport } from "@/lib/validations/search-daily-report"

export type SearchPeriodKind = "month" | "all_time"
export type SearchPeriodReportStatus = "generating" | "complete" | "failed" | "empty"

export type RankedSearchQuery = { query: string; count: number }
export type RankedDemandCapture = { query: string; count: number; people: number }
export type RankedDropdownSelection = { label: string; kind: string; count: number }

export type SearchPeriodReportSnapshot = SearchDailyReportSnapshot & {
  topQueries: RankedSearchQuery[]
  zeroResultQueries: RankedSearchQuery[]
  topDropdownSelections: RankedDropdownSelection[]
  demandCaptureByQuery: RankedDemandCapture[]
}

export type SearchPeriodReportRow = {
  id: string
  period_kind: SearchPeriodKind
  period_key: string
  generated_at: string
  model: string
  status: SearchPeriodReportStatus
  from_iso: string
  to_iso: string
  snapshot: SearchPeriodReportSnapshot
  report: SearchPeriodLlmReport | null
  error: string | null
  created_at: string
  updated_at: string
}

const COLUMNS =
  "id, period_kind, period_key, generated_at, model, status, from_iso, to_iso, snapshot, report, error, created_at, updated_at"

function asRow(raw: unknown): SearchPeriodReportRow | null {
  if (!raw || typeof raw !== "object") return null
  return raw as SearchPeriodReportRow
}

export async function getSearchPeriodReport(
  supabase: SupabaseClient,
  periodKind: SearchPeriodKind,
  periodKey: string,
): Promise<{ row: SearchPeriodReportRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("search_period_reports")
    .select(COLUMNS)
    .eq("period_kind", periodKind)
    .eq("period_key", periodKey)
    .maybeSingle()

  if (error) return { row: null, error: new Error(error.message) }
  return { row: asRow(data), error: null }
}

export async function listSearchPeriodReports(
  supabase: SupabaseClient,
  periodKind: SearchPeriodKind,
  limit: number,
): Promise<{ rows: SearchPeriodReportRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("search_period_reports")
    .select(COLUMNS)
    .eq("period_kind", periodKind)
    .order("period_key", { ascending: false })
    .limit(limit)

  if (error) return { rows: [], error: new Error(error.message) }
  return { rows: (data ?? []) as SearchPeriodReportRow[], error: null }
}

export type UpsertSearchPeriodReportInput = {
  periodKind: SearchPeriodKind
  periodKey: string
  generatedAt: string
  model: string
  status: SearchPeriodReportStatus
  fromIso: string
  toIso: string
  snapshot: SearchPeriodReportSnapshot
  report: SearchPeriodLlmReport | null
  error: string | null
}

export async function upsertSearchPeriodReport(
  supabase: SupabaseClient,
  input: UpsertSearchPeriodReportInput,
): Promise<{ row: SearchPeriodReportRow | null; error: Error | null }> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("search_period_reports")
    .upsert(
      {
        period_kind: input.periodKind,
        period_key: input.periodKey,
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
      { onConflict: "period_kind,period_key" },
    )
    .select(COLUMNS)
    .maybeSingle()

  if (error) return { row: null, error: new Error(error.message) }
  return { row: asRow(data), error: null }
}
