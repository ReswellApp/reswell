/**
 * Monthly and all-time Gemini briefings of marketplace search analytics.
 *
 * Same operator output as the daily report, over a longer window: ranked
 * most-searched items, a demand list, empty-result fixes, and inventory plays.
 * Cron: GET /api/cron/search-period-report.
 */

import { generateText, Output } from "ai"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { getMarketplaceOccurredAtBounds } from "@/lib/elasticsearch/search-analytics-index"
import {
  getSearchPeriodReport,
  listSearchPeriodReports,
  upsertSearchPeriodReport,
  type SearchPeriodKind,
  type SearchPeriodReportRow,
  type SearchPeriodReportSnapshot,
} from "@/lib/db/searchPeriodReports"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import {
  APP_LLM_FEATURES,
  gatewayTagsForFeature,
  resolveConfiguredModel,
} from "@/lib/llm/app-models"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  SEARCH_PERIOD_ALL_TIME_KEY,
  SEARCH_PERIOD_MONTH_RE,
  searchPeriodLlmReportSchema,
  type SearchPeriodLlmReport,
} from "@/lib/validations/search-daily-report"
import {
  applySearchDailySynonymForQuery,
  applySearchDailySynonymProposals,
} from "@/lib/services/searchDailyReportSynonyms"
import {
  pacificMonthBounds,
  previousPacificYearMonth,
  SEARCH_DAILY_REPORT_TZ,
  isSearchDailyReportEnabled,
} from "@/lib/services/searchDailyReport"
import {
  collectSearchReportCorpus,
  SEARCH_REPORT_ALL_TIME_CORPUS,
  SEARCH_REPORT_MONTHLY_CORPUS,
  type SearchReportCorpus,
} from "@/lib/services/searchReportCorpus"

const MONTHLY_DIGEST_METRIC = "Search Monthly Report"
const ALL_TIME_DIGEST_METRIC = "Search All-Time Report"
const PRIOR_MONTHS_FOR_MEMORY = 4

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

function emptyPeriodSnapshot(): SearchPeriodReportSnapshot {
  return {
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
    topQueries: [],
    zeroResultQueries: [],
    topDropdownSelections: [],
    demandCaptureByQuery: [],
  }
}

function snapshotFromCorpus(corpus: SearchReportCorpus): SearchPeriodReportSnapshot {
  return {
    ...corpus.snapshot,
    topQueries: corpus.ranked.topQueries,
    zeroResultQueries: corpus.ranked.zeroResultQueries,
    topDropdownSelections: corpus.ranked.topSelections.map((row) => ({
      label: row.label,
      kind: row.kind,
      count: row.count,
    })),
    demandCaptureByQuery: corpus.ranked.demandCaptureByQuery,
  }
}

function emptyLlmReport(reason: string): SearchPeriodLlmReport {
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

export function resolveSearchPeriodKey(
  kind: SearchPeriodKind,
  key?: string,
): string {
  if (kind === "all_time") return SEARCH_PERIOD_ALL_TIME_KEY
  if (key) {
    if (!SEARCH_PERIOD_MONTH_RE.test(key)) {
      throw new Error(`Invalid month key: ${key}`)
    }
    return key
  }
  return previousPacificYearMonth()
}

export async function resolveSearchPeriodBounds(
  kind: SearchPeriodKind,
  periodKey: string,
): Promise<{ fromIso: string; toExclusiveIso: string; label: string }> {
  if (kind === "month") {
    const { fromIso, toExclusiveIso } = pacificMonthBounds(periodKey)
    return {
      fromIso,
      toExclusiveIso,
      label: formatMonthLabel(periodKey),
    }
  }

  const bounds = await getMarketplaceOccurredAtBounds()
  const toExclusiveIso = new Date().toISOString()
  const fromIso = bounds?.minIso ?? toExclusiveIso
  const since = fromIso.slice(0, 10)
  return {
    fromIso,
    toExclusiveIso,
    label: since ? `All-time search history (since ${since})` : "All-time search history",
  }
}

export function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number)
  if (!year || !month) return yearMonth
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

type PriorBrief = {
  period: string
  executiveSummary: string
  topActions: { title: string; owner: string }[]
  demandItems: string[]
  emptyQueries: string[]
}

function priorBriefsFromRows(rows: SearchPeriodReportRow[], skipKey: string): PriorBrief[] {
  return rows
    .filter((r) => r.period_key !== skipKey && r.report)
    .slice(0, PRIOR_MONTHS_FOR_MEMORY)
    .map((r) => ({
      period: r.period_key,
      executiveSummary: r.report?.executiveSummary ?? "",
      topActions: (r.report?.topActions ?? []).slice(0, 4).map((a) => ({
        title: a.title,
        owner: a.owner,
      })),
      demandItems: (r.report?.demandList ?? []).slice(0, 8).map((d) => d.item),
      emptyQueries: (r.report?.emptySearchFixes ?? []).slice(0, 8).map((f) => f.query),
    }))
}

async function callGeminiForPeriodReport(
  kind: SearchPeriodKind,
  periodKey: string,
  label: string,
  fromIso: string,
  toExclusiveIso: string,
  corpus: SearchReportCorpus,
  prior: PriorBrief[],
): Promise<SearchPeriodLlmReport> {
  const windowNoun = kind === "month" ? "calendar month" : "all-time history"
  const demandCap = kind === "all_time" ? "25–40" : "18–30"
  const { output } = await generateText({
    model: reportModelId(),
    output: Output.object({ schema: searchPeriodLlmReportSchema }),
    system: `You are Reswell's marketplace search analyst. Reswell is a used-surfboard marketplace with buyers and sellers.

You receive ${windowNoun} search telemetry — more data than a daily briefing:
- marketplace searches ranked by volume (typed queries + result counts)
- header-nav dropdown clicks (typeahead picks: brands, listings, categories)
- zero-result / empty searches
- brand-directory searches
- "notify me when listed" demand capture

Your job is a broader operator briefing that improves:
1) Inventory — a ranked demand list of the most-searched items to source
2) Search quality — synonyms, ranking, NL parse misses, typeahead coverage
3) Empty-result recovery — how to make high-volume empty queries succeed
4) Seller side — what sellers should list, how to recruit supply
5) Buyer side — merchandising, typeahead, no-results UX

Rules:
- Be specific. Cite actual query strings and counts from the data.
- Do not invent brands, models, or queries that are not in the payload.
- demandList is required and must be ranked by search volume (then empty-result intensity). Use rankedDemand.mostSearched as the backbone; merge aliases (pod mod / podmod) into one item; attach emptyCount from emptyResultQueries when the term missed.
- Cover more ground than a daily report: ${demandCap} demand-list items when the data supports it.
- Prefer actions a small marketplace team can do this month.
- If prior period briefs are provided, call out recurring unmet demand in recurringFromPriorDays (daysSeen = how many prior periods it appeared).
- likelyCause for empty searches: no_inventory if the term looks like a real board/brand with no listings; synonym_gap if it is likely a spelling/alias of something we sell; typo_or_spelling for obvious typos; nl_parse_miss for natural-language filters that probably failed; wrong_category if they searched the wrong surface; unknown otherwise.
- synonymProposals: for every high-volume empty search that is an alias, nickname, or spacing variant of a catalogHints brand/model, emit a structured rule. Set apply=true only when catalogHints lists that brand/model. Set apply=false when the board is not in the catalog (inventory gap). Do not duplicate existingSynonyms. Leave applied and skippedReason unset.
- topActions: 5–10 concrete next steps, highest leverage first.
- Keep executiveSummary readable in an email (no markdown headings). Longer than a daily summary is fine (6–10 sentences).`,
    prompt: `Period: ${label} (${kind} / ${periodKey})
Timezone: ${SEARCH_DAILY_REPORT_TZ}
Window UTC: ${fromIso} → ${toExclusiveIso}
Headline metrics: ${JSON.stringify(corpus.snapshot)}

Prior period briefs (for continuity — do not repeat them verbatim):
${JSON.stringify(prior)}

Period search telemetry (rankedDemand is the source of truth for the demand list):
${JSON.stringify(corpus.promptPayload)}`,
    temperature: 0.2,
    maxOutputTokens: 16384,
    providerOptions: {
      gateway: {
        tags: gatewayTagsForFeature("search_daily_report"),
      },
    },
  })

  if (!output) {
    throw new Error("Gemini returned no structured period report")
  }
  return output
}

async function notifyAdmins(row: SearchPeriodReportRow): Promise<{ sent: number; skipped: number }> {
  const recipients = digestRecipients()
  if (recipients.length === 0 || !row.report) {
    return { sent: 0, skipped: 0 }
  }

  let sent = 0
  let skipped = 0
  const metricName = row.period_kind === "month" ? MONTHLY_DIGEST_METRIC : ALL_TIME_DIGEST_METRIC
  const properties = {
    period_kind: row.period_kind,
    period_key: row.period_key,
    generated_at: row.generated_at,
    model: row.model,
    total_searches: row.snapshot.totalSearches,
    zero_result_count: row.snapshot.zeroResultEventCount,
    dropdown_clicks: row.snapshot.dropdownClicks,
    executive_summary: row.report.executiveSummary,
    top_actions: row.report.topActions,
    demand_list: (row.report.demandList ?? []).slice(0, 12),
    empty_search_fixes: row.report.emptySearchFixes.slice(0, 8),
    inventory_opportunities: row.report.inventoryOpportunities.slice(0, 8),
    dashboard_url: "/admin/search-daily-report",
  }

  for (const email of recipients) {
    const res = await sendKlaviyoServerEvent({
      metricName,
      properties,
      profile: { email },
      uniqueId: `search-period-report:${row.period_kind}:${row.period_key}:${email}`,
    })
    if (res.ok) sent += 1
    else skipped += 1
  }
  return { sent, skipped }
}

export type RunSearchPeriodReportResult = {
  kind: SearchPeriodKind
  key: string
  status: SearchPeriodReportRow["status"]
  skipped: boolean
  skipReason?: string
  row: SearchPeriodReportRow | null
  notify: { sent: number; skipped: number }
}

export async function runSearchPeriodReport(opts: {
  kind: SearchPeriodKind
  key?: string
  force?: boolean
  notify?: boolean
}): Promise<RunSearchPeriodReportResult> {
  const kind = opts.kind
  const key = resolveSearchPeriodKey(kind, opts.key)
  const force = opts.force === true
  const notify = opts.notify !== false
  const supabase = createServiceRoleClient()

  const existing = await getSearchPeriodReport(supabase, kind, key)
  if (existing.error) throw existing.error
  if (
    existing.row &&
    !force &&
    (existing.row.status === "complete" || existing.row.status === "empty")
  ) {
    return {
      kind,
      key,
      status: existing.row.status,
      skipped: true,
      skipReason: "already_generated",
      row: existing.row,
      notify: { sent: 0, skipped: 0 },
    }
  }

  const { fromIso, toExclusiveIso, label } = await resolveSearchPeriodBounds(kind, key)
  const generatedAt = new Date().toISOString()
  const model = reportModelId()
  const corpusOpts = kind === "all_time" ? SEARCH_REPORT_ALL_TIME_CORPUS : SEARCH_REPORT_MONTHLY_CORPUS

  if (!isElasticsearchConfigured()) {
    const rowRes = await upsertSearchPeriodReport(supabase, {
      periodKind: kind,
      periodKey: key,
      generatedAt,
      model,
      status: "failed",
      fromIso,
      toIso: toExclusiveIso,
      snapshot: emptyPeriodSnapshot(),
      report: null,
      error: "Elasticsearch is not configured; search events are not being recorded.",
    })
    if (rowRes.error) throw rowRes.error
    return {
      kind,
      key,
      status: "failed",
      skipped: false,
      row: rowRes.row,
      notify: { sent: 0, skipped: 0 },
    }
  }

  const corpus = await collectSearchReportCorpus(fromIso, toExclusiveIso, corpusOpts)
  const snapshot = snapshotFromCorpus(corpus)
  const hasSignal =
    snapshot.totalSearches > 0 ||
    snapshot.dropdownClicks > 0 ||
    snapshot.brandDirectorySearches > 0

  if (!hasSignal) {
    const empty = emptyLlmReport(
      `No marketplace searches, dropdown clicks, or brand-directory searches were recorded for ${label}. Tracking may be quiet, or the window is still in progress.`,
    )
    const rowRes = await upsertSearchPeriodReport(supabase, {
      periodKind: kind,
      periodKey: key,
      generatedAt,
      model,
      status: "empty",
      fromIso,
      toIso: toExclusiveIso,
      snapshot,
      report: empty,
      error: null,
    })
    if (rowRes.error) throw rowRes.error
    return {
      kind,
      key,
      status: "empty",
      skipped: false,
      row: rowRes.row,
      notify: { sent: 0, skipped: 0 },
    }
  }

  if (!isSearchDailyReportEnabled()) {
    const rowRes = await upsertSearchPeriodReport(supabase, {
      periodKind: kind,
      periodKey: key,
      generatedAt,
      model,
      status: "failed",
      fromIso,
      toIso: toExclusiveIso,
      snapshot,
      report: null,
      error:
        "Gemini search report is disabled. Set AI_GATEWAY_API_KEY (or Vercel OIDC) and SEARCH_DAILY_REPORT_ENABLED.",
    })
    if (rowRes.error) throw rowRes.error
    return {
      kind,
      key,
      status: "failed",
      skipped: false,
      row: rowRes.row,
      notify: { sent: 0, skipped: 0 },
    }
  }

  const priorList = await listSearchPeriodReports(supabase, "month", PRIOR_MONTHS_FOR_MEMORY + 1)
  const prior = priorBriefsFromRows(priorList.rows, key)

  try {
    const report = await callGeminiForPeriodReport(
      kind,
      key,
      label,
      fromIso,
      toExclusiveIso,
      corpus,
      prior,
    )
    const proposals = (report.synonymProposals ?? []).map((proposal) => ({
      ...proposal,
      applied: undefined,
      skippedReason: undefined,
    }))
    const withSynonyms = await applySearchDailySynonymProposals(
      { ...report, synonymProposals: proposals },
      corpus.catalogHints,
    )
    const rowRes = await upsertSearchPeriodReport(supabase, {
      periodKind: kind,
      periodKey: key,
      generatedAt,
      model,
      status: "complete",
      fromIso,
      toIso: toExclusiveIso,
      snapshot,
      report: { ...report, ...withSynonyms, demandList: report.demandList ?? [] },
      error: null,
    })
    if (rowRes.error) throw rowRes.error
    const notifyResult =
      notify && rowRes.row ? await notifyAdmins(rowRes.row) : { sent: 0, skipped: 0 }
    return {
      kind,
      key,
      status: "complete",
      skipped: false,
      row: rowRes.row,
      notify: notifyResult,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[searchPeriodReport] Gemini failed:", msg)
    const rowRes = await upsertSearchPeriodReport(supabase, {
      periodKind: kind,
      periodKey: key,
      generatedAt,
      model,
      status: "failed",
      fromIso,
      toIso: toExclusiveIso,
      snapshot,
      report: null,
      error: msg,
    })
    if (rowRes.error) throw rowRes.error
    return {
      kind,
      key,
      status: "failed",
      skipped: false,
      row: rowRes.row,
      notify: { sent: 0, skipped: 0 },
    }
  }
}

export async function applySearchPeriodReportSynonym(opts: {
  kind: SearchPeriodKind
  key: string
  query: string
  createdBy?: string | null
}): Promise<{ ok: true; row: SearchPeriodReportRow } | { ok: false; error: string }> {
  const supabase = createServiceRoleClient()
  const { row, error } = await getSearchPeriodReport(supabase, opts.kind, opts.key)
  if (error) return { ok: false, error: error.message }
  if (!row?.report) return { ok: false, error: "No report for that period." }

  const nextReport = await applySearchDailySynonymForQuery(
    {
      ...row.report,
      synonymProposals: row.report.synonymProposals ?? [],
    },
    opts.query,
    [],
    opts.createdBy,
  )
  const saved = await upsertSearchPeriodReport(supabase, {
    periodKind: row.period_kind,
    periodKey: row.period_key,
    generatedAt: row.generated_at,
    model: row.model,
    status: row.status,
    fromIso: row.from_iso,
    toIso: row.to_iso,
    snapshot: row.snapshot,
    report: { ...row.report, ...nextReport, demandList: row.report.demandList ?? [] },
    error: row.error,
  })
  if (saved.error || !saved.row) {
    return { ok: false, error: saved.error?.message ?? "Could not save the report." }
  }
  return { ok: true, row: saved.row }
}

export async function getSearchPeriodReportService(
  kind: SearchPeriodKind,
  key: string,
): Promise<SearchPeriodReportRow | null> {
  const supabase = createServiceRoleClient()
  const { row, error } = await getSearchPeriodReport(supabase, kind, key)
  if (error) throw error
  return row
}

export async function listSearchPeriodReportsService(
  kind: SearchPeriodKind,
  limit: number,
): Promise<SearchPeriodReportRow[]> {
  const supabase = createServiceRoleClient()
  const { rows, error } = await listSearchPeriodReports(supabase, kind, limit)
  if (error) throw error
  return rows
}

export type SearchPeriodReportIndexItem = {
  kind: SearchPeriodKind
  key: string
  status: SearchPeriodReportRow["status"]
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
  demandListCount: number
  error: string | null
}

export function toSearchPeriodReportIndexItem(
  row: SearchPeriodReportRow,
): SearchPeriodReportIndexItem {
  const proposals = row.report?.synonymProposals ?? []
  return {
    kind: row.period_kind,
    key: row.period_key,
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
    demandListCount: row.report?.demandList?.length ?? 0,
    error: row.error,
  }
}

export type { SearchPeriodKind, SearchPeriodReportRow, SearchPeriodReportSnapshot } from "@/lib/db/searchPeriodReports"
