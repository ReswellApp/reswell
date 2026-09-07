import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  BusinessIntelligenceReportListItem,
  BusinessIntelligenceReportRow,
  BusinessIntelligenceSnapshot,
} from "@/lib/types/businessIntelligence"
import type { BusinessIntelligenceLlmReport } from "@/lib/validations/businessIntelligence"
import type { BusinessIntelligencePeriodKind } from "@/lib/validations/businessIntelligence"
import type { BusinessIntelligenceReportStatus } from "@/lib/types/businessIntelligence"

const COLUMNS =
  "id, period_kind, period_key, period_start, period_end, generated_at, model, status, from_iso, to_iso, snapshot, report, error, created_at, updated_at"

const LIST_COLUMNS =
  "id, period_kind, period_key, period_start, period_end, generated_at, model, status, report, error"

function asRow(raw: unknown): BusinessIntelligenceReportRow | null {
  if (!raw || typeof raw !== "object") return null
  return raw as BusinessIntelligenceReportRow
}

function listItemFromRaw(raw: unknown): BusinessIntelligenceReportListItem | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const report = r.report
  let executiveSummary: string | null = null
  if (report && typeof report === "object") {
    const summary = (report as Record<string, unknown>).executiveSummary
    if (typeof summary === "string" && summary.trim()) executiveSummary = summary
  }
  return {
    id: String(r.id ?? ""),
    period_kind: r.period_kind as BusinessIntelligencePeriodKind,
    period_key: String(r.period_key ?? ""),
    period_start: String(r.period_start ?? ""),
    period_end: String(r.period_end ?? ""),
    generated_at: String(r.generated_at ?? ""),
    model: String(r.model ?? ""),
    status: r.status as BusinessIntelligenceReportStatus,
    error: r.error == null ? null : String(r.error),
    executiveSummary,
  }
}

export async function getBusinessIntelligenceReport(
  supabase: SupabaseClient,
  kind: BusinessIntelligencePeriodKind,
  periodKey: string,
): Promise<{ row: BusinessIntelligenceReportRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("business_intelligence_reports")
    .select(COLUMNS)
    .eq("period_kind", kind)
    .eq("period_key", periodKey)
    .maybeSingle()

  if (error) return { row: null, error: new Error(error.message) }
  return { row: asRow(data), error: null }
}

export async function getLatestBusinessIntelligenceReport(
  supabase: SupabaseClient,
  kind: BusinessIntelligencePeriodKind,
): Promise<{ row: BusinessIntelligenceReportRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("business_intelligence_reports")
    .select(COLUMNS)
    .eq("period_kind", kind)
    .eq("status", "complete")
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { row: null, error: new Error(error.message) }
  return { row: asRow(data), error: null }
}

export async function listBusinessIntelligenceReports(
  supabase: SupabaseClient,
  options: { kind?: BusinessIntelligencePeriodKind; limit: number },
): Promise<{ rows: BusinessIntelligenceReportListItem[]; error: Error | null }> {
  let query = supabase
    .from("business_intelligence_reports")
    .select(LIST_COLUMNS)
    .order("period_start", { ascending: false })
    .limit(options.limit)

  if (options.kind) query = query.eq("period_kind", options.kind)

  const { data, error } = await query
  if (error) return { rows: [], error: new Error(error.message) }
  const rows: BusinessIntelligenceReportListItem[] = []
  for (const raw of data ?? []) {
    const item = listItemFromRaw(raw)
    if (item) rows.push(item)
  }
  return { rows, error: null }
}

export async function listRecentCompleteReportsForLlm(
  supabase: SupabaseClient,
  limit: number,
): Promise<{ rows: BusinessIntelligenceReportRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("business_intelligence_reports")
    .select(COLUMNS)
    .eq("status", "complete")
    .order("period_start", { ascending: false })
    .limit(limit)

  if (error) return { rows: [], error: new Error(error.message) }
  return {
    rows: (data ?? []).map(asRow).filter((r): r is BusinessIntelligenceReportRow => r != null),
    error: null,
  }
}

export type UpsertBusinessIntelligenceReportInput = {
  periodKind: BusinessIntelligencePeriodKind
  periodKey: string
  periodStart: string
  periodEnd: string
  generatedAt: string
  model: string
  status: BusinessIntelligenceReportStatus
  fromIso: string
  toIso: string
  snapshot: BusinessIntelligenceSnapshot | Record<string, never>
  report: BusinessIntelligenceLlmReport | null
  error: string | null
}

export async function upsertBusinessIntelligenceReport(
  supabase: SupabaseClient,
  input: UpsertBusinessIntelligenceReportInput,
): Promise<{ row: BusinessIntelligenceReportRow | null; error: Error | null }> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("business_intelligence_reports")
    .upsert(
      {
        period_kind: input.periodKind,
        period_key: input.periodKey,
        period_start: input.periodStart,
        period_end: input.periodEnd,
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
