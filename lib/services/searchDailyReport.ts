/**
 * Daily Gemini briefing of marketplace search analytics.
 *
 * Collects every logged search, dropdown pick, and zero-result query for a
 * Pacific calendar day, then asks Gemini to recommend inventory, search, and
 * marketplace improvements. Cron: GET /api/cron/search-daily-report.
 */

import { generateText, Output } from "ai"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import {
  getSearchDailyReportByDate,
  listSearchDailyReports,
  upsertSearchDailyReport,
  type SearchDailyReportRow,
} from "@/lib/db/searchDailyReports"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import {
  APP_LLM_FEATURES,
  gatewayTagsForFeature,
  isAppLlmFeatureEnabled,
  resolveConfiguredModel,
} from "@/lib/llm/app-models"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  searchDailyLlmReportSchema,
  type SearchDailyLlmReport,
} from "@/lib/validations/search-daily-report"
import {
  applySearchDailySynonymForQuery,
  applySearchDailySynonymProposals,
} from "@/lib/services/searchDailyReportSynonyms"
import {
  collectSearchReportCorpus,
  SEARCH_REPORT_DAILY_CORPUS,
  type SearchReportCorpus,
} from "@/lib/services/searchReportCorpus"

export const SEARCH_DAILY_REPORT_TZ = "America/Los_Angeles"

const DIGEST_METRIC = "Search Daily Report"
const PRIOR_REPORTS_FOR_MEMORY = 7

function searchDailyReportFeature() {
  const feature = APP_LLM_FEATURES.find((f) => f.id === "search_daily_report")
  if (!feature) {
    throw new Error("search_daily_report is missing from APP_LLM_FEATURES")
  }
  return feature
}

function reportModelId(): string {
  return resolveConfiguredModel(searchDailyReportFeature())
}

export function isSearchDailyReportEnabled(): boolean {
  return isAppLlmFeatureEnabled(searchDailyReportFeature())
}

function digestRecipients(): string[] {
  const raw = process.env.ADMIN_DIGEST_EMAILS ?? ""
  return Array.from(
    new Set(
      raw
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    ),
  )
}

function formatParts(
  date: Date,
  timeZone: string,
): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const out: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== "literal") out[p.type] = p.value
  }
  return out
}

/** YYYY-MM-DD in America/Los_Angeles. */
export function pacificCalendarDate(at: Date = new Date()): string {
  const p = formatParts(at, SEARCH_DAILY_REPORT_TZ)
  return `${p.year}-${p.month}-${p.day}`
}

/** Previous complete Pacific calendar day (the default cron target). */
export function previousPacificCalendarDate(at: Date = new Date()): string {
  const today = pacificCalendarDate(at)
  const startToday = zonedDateTimeToUtc(today, 0, 0, 0, SEARCH_DAILY_REPORT_TZ)
  const prev = new Date(startToday.getTime() - 12 * 60 * 60 * 1000)
  return pacificCalendarDate(prev)
}

/**
 * Convert a wall-clock time in `timeZone` on `ymd` (YYYY-MM-DD) to a UTC Date.
 * Iteratively corrects for DST so Pacific midnight is exact.
 */
function zonedDateTimeToUtc(
  ymd: string,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const [year, month, day] = ymd.split("-").map(Number)
  if (!year || !month || !day) {
    throw new Error(`Invalid calendar date: ${ymd}`)
  }
  let utc = Date.UTC(year, month - 1, day, hour, minute, second)
  for (let i = 0; i < 4; i += 1) {
    const p = formatParts(new Date(utc), timeZone)
    const localAsUtc = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second),
    )
    const desired = Date.UTC(year, month - 1, day, hour, minute, second)
    utc += desired - localAsUtc
  }
  return new Date(utc)
}

export function pacificDayBounds(ymd: string): { fromIso: string; toExclusiveIso: string } {
  const from = zonedDateTimeToUtc(ymd, 0, 0, 0, SEARCH_DAILY_REPORT_TZ)
  const nextLocal = new Date(from.getTime() + 36 * 60 * 60 * 1000)
  const nextYmd = pacificCalendarDate(nextLocal)
  const toExclusive = zonedDateTimeToUtc(nextYmd, 0, 0, 0, SEARCH_DAILY_REPORT_TZ)
  return { fromIso: from.toISOString(), toExclusiveIso: toExclusive.toISOString() }
}

/** YYYY-MM in America/Los_Angeles. */
export function pacificYearMonth(at: Date = new Date()): string {
  return pacificCalendarDate(at).slice(0, 7)
}

/** Previous complete Pacific calendar month. */
export function previousPacificYearMonth(at: Date = new Date()): string {
  const [year, month] = pacificYearMonth(at).split("-").map(Number)
  if (!year || !month) throw new Error("Invalid Pacific year-month")
  if (month === 1) return `${year - 1}-12`
  return `${year}-${String(month - 1).padStart(2, "0")}`
}

export function pacificMonthBounds(yearMonth: string): { fromIso: string; toExclusiveIso: string } {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error(`Invalid year-month: ${yearMonth}`)
  }
  const [year, month] = yearMonth.split("-").map(Number)
  const startYmd = `${yearMonth}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const nextYmd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
  const from = zonedDateTimeToUtc(startYmd, 0, 0, 0, SEARCH_DAILY_REPORT_TZ)
  const toExclusive = zonedDateTimeToUtc(nextYmd, 0, 0, 0, SEARCH_DAILY_REPORT_TZ)
  return { fromIso: from.toISOString(), toExclusiveIso: toExclusive.toISOString() }
}

type DailyReportCorpus = SearchReportCorpus

function collectDailyReportCorpus(
  fromIso: string,
  toExclusiveIso: string,
): Promise<DailyReportCorpus> {
  return collectSearchReportCorpus(fromIso, toExclusiveIso, SEARCH_REPORT_DAILY_CORPUS)
}

function emptyLlmReport(reason: string): SearchDailyLlmReport {
  return {
    executiveSummary: reason,
    demandThemes: [],
    emptySearchFixes: [],
    dropdownInsights: [],
    inventoryOpportunities: [],
    searchQuality: [],
    sellerOpportunities: [],
    buyerExperience: [],
    recurringFromPriorDays: [],
    topActions: [],
    synonymProposals: [],
    demandList: [],
  }
}

type PriorBrief = {
  date: string
  executiveSummary: string
  topActions: { title: string; owner: string }[]
  emptyQueries: string[]
}

function priorBriefsFromRows(rows: SearchDailyReportRow[], skipDate: string): PriorBrief[] {
  return rows
    .filter((r) => r.report_date !== skipDate && r.report)
    .slice(0, PRIOR_REPORTS_FOR_MEMORY)
    .map((r) => ({
      date: r.report_date,
      executiveSummary: r.report?.executiveSummary ?? "",
      topActions: (r.report?.topActions ?? []).slice(0, 4).map((a) => ({
        title: a.title,
        owner: a.owner,
      })),
      emptyQueries: (r.report?.emptySearchFixes ?? []).slice(0, 8).map((f) => f.query),
    }))
}

async function callGeminiForDailyReport(
  reportDate: string,
  fromIso: string,
  toExclusiveIso: string,
  corpus: DailyReportCorpus,
  prior: PriorBrief[],
): Promise<SearchDailyLlmReport> {
  const { output } = await generateText({
    model: reportModelId(),
    output: Output.object({ schema: searchDailyLlmReportSchema }),
    system: `You are Reswell's marketplace search analyst. Reswell is a used-surfboard marketplace with buyers and sellers.

You receive one Pacific calendar day's search telemetry:
- marketplace searches (typed queries + result counts)
- header-nav dropdown clicks (typeahead picks: brands, listings, categories)
- zero-result / empty searches
- brand-directory searches
- "notify me when listed" demand capture

Your job is to learn from this day and produce an operator briefing that improves:
1) Inventory — what to source, which brands/models/sizes are missing
2) Search quality — synonyms, ranking, NL parse misses, typeahead coverage
3) Empty-result recovery — how to make those queries succeed next time
4) Seller side — what sellers should list, how to recruit supply
5) Buyer side — merchandising, typeahead, no-results UX

Rules:
- Be specific. Cite actual query strings and counts from the data.
- Do not invent brands, models, or queries that are not in the payload.
- Prefer actions a small marketplace team can do this week.
- If prior-day briefs are provided, call out recurring unmet demand in recurringFromPriorDays.
- likelyCause for empty searches: no_inventory if the term looks like a real board/brand with no listings; synonym_gap if it is likely a spelling/alias of something we sell; typo_or_spelling for obvious typos; nl_parse_miss for natural-language filters that probably failed; wrong_category if they searched the wrong surface; unknown otherwise.
- synonymProposals: for every empty search that is an alias, nickname, or spacing variant of a catalogHints brand/model (e.g. "pod mod" / "podmod" → Channel Islands Pod Mod; "mini magic" → Walden Mini Magic), emit a structured rule. Set apply=true only when catalogHints lists that brand/model. Set apply=false when the board is not in the catalog (inventory gap). Do not duplicate existingSynonyms. Leave applied and skippedReason unset.
- topActions: 3–7 concrete next steps, highest leverage first.
- demandList: ranked 5–12 most-searched items to source, citing actual query counts.
- Keep executiveSummary readable in an email (no markdown headings).`,
    prompt: `Pacific calendar date: ${reportDate} (${SEARCH_DAILY_REPORT_TZ})
Window UTC: ${fromIso} → ${toExclusiveIso}
Headline metrics: ${JSON.stringify(corpus.snapshot)}

Prior daily briefs (for continuity — do not repeat them verbatim):
${JSON.stringify(prior)}

Today's search telemetry:
${JSON.stringify(corpus.promptPayload)}`,
    temperature: 0.2,
    maxOutputTokens: 8192,
    providerOptions: {
      gateway: {
        tags: gatewayTagsForFeature("search_daily_report"),
      },
    },
  })

  if (!output) {
    throw new Error("Gemini returned no structured daily report")
  }
  return output
}

async function notifyAdmins(row: SearchDailyReportRow): Promise<{ sent: number; skipped: number }> {
  const recipients = digestRecipients()
  if (recipients.length === 0 || !row.report) {
    return { sent: 0, skipped: 0 }
  }

  let sent = 0
  let skipped = 0
  const properties = {
    report_date: row.report_date,
    generated_at: row.generated_at,
    model: row.model,
    total_searches: row.snapshot.totalSearches,
    zero_result_count: row.snapshot.zeroResultEventCount,
    dropdown_clicks: row.snapshot.dropdownClicks,
    executive_summary: row.report.executiveSummary,
    top_actions: row.report.topActions,
    empty_search_fixes: row.report.emptySearchFixes.slice(0, 8),
    inventory_opportunities: row.report.inventoryOpportunities.slice(0, 8),
    dashboard_url: "/admin/search-daily-report",
  }

  for (const email of recipients) {
    const res = await sendKlaviyoServerEvent({
      metricName: DIGEST_METRIC,
      properties,
      profile: { email },
      uniqueId: `search-daily-report:${row.report_date}:${email}`,
    })
    if (res.ok) sent += 1
    else skipped += 1
  }
  return { sent, skipped }
}

export type RunSearchDailyReportResult = {
  date: string
  status: SearchDailyReportRow["status"]
  skipped: boolean
  skipReason?: string
  row: SearchDailyReportRow | null
  notify: { sent: number; skipped: number }
}

export async function runSearchDailyReport(opts: {
  date?: string
  force?: boolean
  notify?: boolean
}): Promise<RunSearchDailyReportResult> {
  const date = opts.date ?? previousPacificCalendarDate()
  const force = opts.force === true
  const notify = opts.notify !== false
  const supabase = createServiceRoleClient()

  const existing = await getSearchDailyReportByDate(supabase, date)
  if (existing.error) {
    throw existing.error
  }
  if (
    existing.row &&
    !force &&
    (existing.row.status === "complete" || existing.row.status === "empty")
  ) {
    return {
      date,
      status: existing.row.status,
      skipped: true,
      skipReason: "already_generated",
      row: existing.row,
      notify: { sent: 0, skipped: 0 },
    }
  }

  const { fromIso, toExclusiveIso } = pacificDayBounds(date)
  const generatedAt = new Date().toISOString()
  const model = reportModelId()

  if (!isElasticsearchConfigured()) {
    const rowRes = await upsertSearchDailyReport(supabase, {
      reportDate: date,
      generatedAt,
      model,
      status: "failed",
      fromIso,
      toIso: toExclusiveIso,
      snapshot: {
        totalSearches: 0,
        uniqueQueriesApprox: 0,
        zeroResultEventCount: 0,
        zeroResultShare: null,
        avgResultCount: null,
        dropdownClicks: 0,
        dropdownHovers: 0,
        navFreeFormSubmits: 0,
        navDropdownSelections: 0,
        brandDirectorySearches: 0,
        brandDirectoryZeroResults: 0,
        demandCaptureTotal: 0,
        eventSampleCount: 0,
      },
      report: null,
      error: "Elasticsearch is not configured; search events are not being recorded.",
    })
    if (rowRes.error) throw rowRes.error
    return {
      date,
      status: "failed",
      skipped: false,
      row: rowRes.row,
      notify: { sent: 0, skipped: 0 },
    }
  }

  const corpus = await collectDailyReportCorpus(fromIso, toExclusiveIso)
  const hasSignal =
    corpus.snapshot.totalSearches > 0 ||
    corpus.snapshot.dropdownClicks > 0 ||
    corpus.snapshot.brandDirectorySearches > 0

  if (!hasSignal) {
    const empty = emptyLlmReport(
      `No marketplace searches, dropdown clicks, or brand-directory searches were recorded on ${date} (Pacific). Tracking may be quiet, or the day is still in progress.`,
    )
    const rowRes = await upsertSearchDailyReport(supabase, {
      reportDate: date,
      generatedAt,
      model,
      status: "empty",
      fromIso,
      toIso: toExclusiveIso,
      snapshot: corpus.snapshot,
      report: empty,
      error: null,
    })
    if (rowRes.error) throw rowRes.error
    return {
      date,
      status: "empty",
      skipped: false,
      row: rowRes.row,
      notify: { sent: 0, skipped: 0 },
    }
  }

  if (!isSearchDailyReportEnabled()) {
    const rowRes = await upsertSearchDailyReport(supabase, {
      reportDate: date,
      generatedAt,
      model,
      status: "failed",
      fromIso,
      toIso: toExclusiveIso,
      snapshot: corpus.snapshot,
      report: null,
      error:
        "Gemini daily report is disabled. Set AI_GATEWAY_API_KEY (or Vercel OIDC) and SEARCH_DAILY_REPORT_ENABLED.",
    })
    if (rowRes.error) throw rowRes.error
    return {
      date,
      status: "failed",
      skipped: false,
      row: rowRes.row,
      notify: { sent: 0, skipped: 0 },
    }
  }

  const priorList = await listSearchDailyReports(supabase, PRIOR_REPORTS_FOR_MEMORY + 1)
  const prior = priorBriefsFromRows(priorList.rows, date)

  try {
    const report = await callGeminiForDailyReport(date, fromIso, toExclusiveIso, corpus, prior)
    const proposals = (report.synonymProposals ?? []).map((proposal) => ({
      ...proposal,
      applied: undefined,
      skippedReason: undefined,
    }))
    const withSynonyms = await applySearchDailySynonymProposals(
      { ...report, synonymProposals: proposals },
      corpus.catalogHints,
    )
    const rowRes = await upsertSearchDailyReport(supabase, {
      reportDate: date,
      generatedAt,
      model,
      status: "complete",
      fromIso,
      toIso: toExclusiveIso,
      snapshot: corpus.snapshot,
      report: withSynonyms,
      error: null,
    })
    if (rowRes.error) throw rowRes.error
    const notifyResult =
      notify && rowRes.row ? await notifyAdmins(rowRes.row) : { sent: 0, skipped: 0 }
    return {
      date,
      status: "complete",
      skipped: false,
      row: rowRes.row,
      notify: notifyResult,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[searchDailyReport] Gemini failed:", msg)
    const rowRes = await upsertSearchDailyReport(supabase, {
      reportDate: date,
      generatedAt,
      model,
      status: "failed",
      fromIso,
      toIso: toExclusiveIso,
      snapshot: corpus.snapshot,
      report: null,
      error: msg,
    })
    if (rowRes.error) throw rowRes.error
    return {
      date,
      status: "failed",
      skipped: false,
      row: rowRes.row,
      notify: { sent: 0, skipped: 0 },
    }
  }
}

export async function applySearchDailyReportSynonym(opts: {
  date: string
  query: string
  createdBy?: string | null
}): Promise<
  | { ok: true; row: SearchDailyReportRow }
  | { ok: false; error: string }
> {
  const supabase = createServiceRoleClient()
  const { row, error } = await getSearchDailyReportByDate(supabase, opts.date)
  if (error) return { ok: false, error: error.message }
  if (!row?.report) return { ok: false, error: "No report for that date." }

  const nextReport = await applySearchDailySynonymForQuery(
    {
      ...row.report,
      synonymProposals: row.report.synonymProposals ?? [],
    },
    opts.query,
    [],
    opts.createdBy,
  )
  const saved = await upsertSearchDailyReport(supabase, {
    reportDate: row.report_date,
    generatedAt: row.generated_at,
    model: row.model,
    status: row.status,
    fromIso: row.from_iso,
    toIso: row.to_iso,
    snapshot: row.snapshot,
    report: nextReport,
    error: row.error,
  })
  if (saved.error || !saved.row) {
    return { ok: false, error: saved.error?.message ?? "Could not save the report." }
  }
  return { ok: true, row: saved.row }
}

export async function getSearchDailyReportService(date: string): Promise<SearchDailyReportRow | null> {
  const supabase = createServiceRoleClient()
  const { row, error } = await getSearchDailyReportByDate(supabase, date)
  if (error) throw error
  return row
}

export async function listSearchDailyReportsService(
  limit: number,
): Promise<SearchDailyReportRow[]> {
  const supabase = createServiceRoleClient()
  const { rows, error } = await listSearchDailyReports(supabase, limit)
  if (error) throw error
  return rows
}

export type SearchDailyReportIndexItem = {
  date: string
  status: SearchDailyReportRow["status"]
  generatedAt: string
  totalSearches: number
  uniqueQueriesApprox: number
  zeroResultEventCount: number
  zeroResultShare: number | null
  dropdownClicks: number
  demandCaptureTotal: number
  executiveSummary: string | null
  synonymAppliedCount: number
  emptyFixCount: number
  error: string | null
}

export function toSearchDailyReportIndexItem(
  row: SearchDailyReportRow,
): SearchDailyReportIndexItem {
  const proposals = row.report?.synonymProposals ?? []
  return {
    date: row.report_date,
    status: row.status,
    generatedAt: row.generated_at,
    totalSearches: row.snapshot.totalSearches,
    uniqueQueriesApprox: row.snapshot.uniqueQueriesApprox,
    zeroResultEventCount: row.snapshot.zeroResultEventCount,
    zeroResultShare: row.snapshot.zeroResultShare,
    dropdownClicks: row.snapshot.dropdownClicks,
    demandCaptureTotal: row.snapshot.demandCaptureTotal,
    executiveSummary: row.report?.executiveSummary ?? null,
    synonymAppliedCount: proposals.filter((p) => p.applied).length,
    emptyFixCount: row.report?.emptySearchFixes.length ?? 0,
    error: row.error,
  }
}

export type { SearchDailyReportRow, SearchDailyReportSnapshot } from "@/lib/db/searchDailyReports"
