import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { aggregateDemandCaptureByQuery } from "@/lib/db/searchDemandCapture"
import {
  aggregateMarketplaceHourOfDay,
  aggregateSearchAnalytics,
  aggregateNavBarMarketplaceKeywordAnalytics,
  getMarketplaceOccurredAtBounds,
  indexSearchAnalyticsDocument,
  listNavBarMarketplaceKeywordEvents,
  topQueriesInRange,
  type NavBarMarketplaceKeywordEventHit,
  type SearchAnalyticsDoc,
} from "@/lib/elasticsearch/search-analytics-index"
import {
  aggregateSearchSuggestPicks,
  aggregateHeaderNavSuggestClickAnalytics,
  indexSearchSuggestPickDocument,
  listHeaderNavSuggestPickEvents,
  type HeaderNavSuggestPickEventHit,
  type SearchSuggestPickDoc,
  type SearchSuggestPickKind,
  type SearchSuggestPickSurface,
  type SearchSuggestPickTrace,
  type SearchSuggestInteraction,
} from "@/lib/elasticsearch/search-suggest-analytics-index"

export type MarketplaceSearchAnalyticsPayload = {
  queryDisplay: string
  queryNormalized: string
  resultCount: number
  backend: "elasticsearch" | "supabase"
  categorySlug: string | null
  /** When `/search` opened from header nav (`nq=1` query marker). */
  originSurface?: "header_nav"
}

/** Lowercase, single spaces, capped length — used for aggregations. */
export function normalizeMarketplaceSearchQueryForAnalytics(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 500)
}

export function displayMarketplaceSearchQueryForAnalytics(raw: string): string {
  return raw.trim().slice(0, 500)
}

export async function recordMarketplaceSearchAnalyticsEvent(
  payload: MarketplaceSearchAnalyticsPayload,
): Promise<void> {
  if (!isElasticsearchConfigured()) return
  if (!payload.queryNormalized.trim()) return

  const doc: SearchAnalyticsDoc = {
    occurred_at: new Date().toISOString(),
    query_normalized: payload.queryNormalized,
    query_display: payload.queryDisplay,
    result_count: payload.resultCount,
    backend: payload.backend,
    search_surface: "marketplace",
    ...(payload.originSurface ? { origin_surface: payload.originSurface } : {}),
    category_slug: payload.categorySlug,
    has_category_filter: Boolean(payload.categorySlug),
  }

  await indexSearchAnalyticsDocument(doc)
}

export type BrandDirectorySearchAnalyticsPayload = {
  queryDisplay: string
  queryNormalized: string
  /** Number of brand rows returned from `searchBrandsCatalogSuggest`. */
  resultCount: number
  backend: "elasticsearch" | "supabase"
}

export async function recordBrandDirectorySearchAnalyticsEvent(
  payload: BrandDirectorySearchAnalyticsPayload,
): Promise<void> {
  if (!isElasticsearchConfigured()) return
  if (!payload.queryNormalized.trim()) return

  const doc: SearchAnalyticsDoc = {
    occurred_at: new Date().toISOString(),
    query_normalized: payload.queryNormalized,
    query_display: payload.queryDisplay,
    result_count: payload.resultCount,
    backend: payload.backend,
    search_surface: "brand_directory",
    category_slug: null,
    has_category_filter: false,
  }

  await indexSearchAnalyticsDocument(doc)
}

export type SearchSuggestPickPayload = {
  surface: SearchSuggestPickSurface
  pickKind: SearchSuggestPickKind
  suggestTrace: SearchSuggestPickTrace
  queryPrefix: string
  selectionLabel: string
  listingId: string | null
  interaction?: SearchSuggestInteraction
}

export async function recordSearchSuggestPickEvent(
  payload: SearchSuggestPickPayload,
): Promise<void> {
  if (!isElasticsearchConfigured()) return
  const q = payload.queryPrefix.trim()
  if (!q) return

  const doc: SearchSuggestPickDoc = {
    occurred_at: new Date().toISOString(),
    surface: payload.surface,
    pick_kind: payload.pickKind,
    suggest_trace: payload.suggestTrace,
    interaction: payload.interaction ?? "pick",
    query_prefix: q.slice(0, 500),
    selection_label: payload.selectionLabel.trim().slice(0, 500) || "—",
    listing_id: payload.listingId,
  }

  await indexSearchSuggestPickDocument(doc)
}

export type SearchAnalyticsTrendingRow = {
  query: string
  recentCount: number
  previousCount: number
  /** recentCount / (previousCount + 1); higher means growth vs the prior window. */
  velocity: number
}

/** One header-nav search action (free-form `/search` submit or typeahead row click). */
export type NavSearchBarEventLine = {
  id: string
  occurredAt: string
  kind: "free_form" | "dropdown"
  query: string
  detail: string | null
  resultCount: number | null
  pickKind: string | null
}

const NAV_SEARCH_BAR_RECENT_PER_SOURCE = 120
const NAV_SEARCH_BAR_RECENT_MERGED_CAP = 200

/** Priority ranking for sorting the insights feed (lower = more urgent). */
export type SearchInsightSeverity = "critical" | "warning" | "opportunity" | "positive"

export type SearchInsightCategory =
  | "demand"
  | "inventory"
  | "relevance"
  | "infrastructure"
  | "engagement"
  | "growth"

/** A single, business-facing insight + concrete recommended action. */
export type SearchInsight = {
  id: string
  severity: SearchInsightSeverity
  category: SearchInsightCategory
  /** Short headline. */
  title: string
  /** What the data shows. */
  finding: string
  /** The concrete step to take. */
  action: string
  /** Optional one-line estimated business impact. */
  impact?: string
  /** Optional highlighted metric (e.g. "18%"). */
  metricLabel?: string
  metricValue?: string
  /** Related query terms / entities driving the insight. */
  examples?: string[]
}

/** "What matters most" headline metrics derived from the raw aggregates. */
export type SearchAnalyticsHeadline = {
  /** Share of searches that ended in a typeahead suggestion click. */
  typeaheadEngagementRate: number | null
  /** Share of searches served by the database fallback (vs Elasticsearch). */
  databaseFallbackShare: number | null
  /** Second-half vs first-half search-volume momentum (-1..∞). */
  volumeMomentum: number | null
  /** Estimated count of searches that hit a dead end (zero results). */
  unmetDemandSearches: number
  /** Header-nav dropdown picks ÷ (free-form submits + dropdown picks). */
  navDropdownShare: number | null
  /** Count of opportunity/warning/critical insights surfaced. */
  actionableInsightCount: number
}

export type SearchAnalyticsDashboard = {
  configured: boolean
  rangeDays: number
  from: string
  to: string
  totalSearches: number
  uniqueQueriesApprox: number
  avgResultCount: number | null
  zeroResultSearchShare: number | null
  /** ~1 = one dominant query; lower = flatter demand (top 20 queries, Herfindahl). */
  queryConcentration: number | null
  resultCountStats: {
    min: number | null
    max: number | null
    stdDeviation: number | null
  }
  resultCountDistribution: { band: string; count: number }[]
  categoryFilterSplit: { key: string; count: number }[]
  topCategorySlugs: { slug: string; count: number }[]
  volumeByDay: { date: string; count: number }[]
  /** Marketplace searches folded into UTC hour-of-day buckets (0–23). */
  hourOfDay: { hour: number; count: number }[]
  topQueries: { query: string; count: number }[]
  zeroResultQueries: { query: string; count: number }[]
  byBackend: { backend: string; count: number }[]
  trendingQueries: SearchAnalyticsTrendingRow[]
  /** Typeahead dropdown clicks (excludes hover-only events) in the selected range. */
  suggestPickTotal: number
  suggestHoverTotal: number
  suggestPicksByKind: { kind: string; count: number }[]
  suggestPicksByTrace: { trace: string; count: number }[]
  suggestHoversByKind: { kind: string; count: number }[]
  suggestTopQueryPrefixes: { prefix: string; count: number }[]
  suggestTopQueryPrefixesHover: { prefix: string; count: number }[]
  suggestTopListingClicks: { listingId: string; title: string; count: number }[]
  brandDirectory: {
    totalSearches: number
    uniqueQueriesApprox: number
    avgResultCount: number | null
    zeroResultSearchShare: number | null
    volumeByDay: { date: string; count: number }[]
    topQueries: { query: string; count: number }[]
    zeroResultQueries: { query: string; count: number }[]
    byBackend: { backend: string; count: number }[]
  }
  /** Header nav bar only — typed `/search` submits (`nq=1`) vs dropdown row clicks (`surface: header_nav`). */
  navSearchBar: {
    volumeByDay: {
      date: string
      freeFormSubmits: number
      dropdownSelections: number
    }[]
    totalFreeFormSubmits: number
    totalDropdownSelections: number
    topFreeFormQueries: { query: string; count: number }[]
    /** Newest-first line items for the selected range (capped). */
    recentEvents: NavSearchBarEventLine[]
  }
  /** Buyer "notify me when listed" demand captured on no-results screens, by query. */
  demandCapture: {
    total: number
    uniquePeople: number
    byQuery: { query: string; count: number; people: number; lastAt: string }[]
  }
  /** "What matters most" derived headline metrics. */
  headline: SearchAnalyticsHeadline
  /** Prioritized, business-facing insights with recommended actions. */
  insights: SearchInsight[]
  fetchedAt: string
}

/** Dashboard payload before insights/headline are layered on. */
type SearchAnalyticsDashboardBase = Omit<SearchAnalyticsDashboard, "headline" | "insights">

const SEVERITY_RANK: Record<SearchInsightSeverity, number> = {
  critical: 0,
  warning: 1,
  opportunity: 2,
  positive: 3,
}

const EMPTY_BRAND_DIRECTORY_DASH: SearchAnalyticsDashboard["brandDirectory"] = {
  totalSearches: 0,
  uniqueQueriesApprox: 0,
  avgResultCount: null,
  zeroResultSearchShare: null,
  volumeByDay: [],
  topQueries: [],
  zeroResultQueries: [],
  byBackend: [],
}

const EMPTY_DEMAND_CAPTURE: SearchAnalyticsDashboard["demandCapture"] = {
  total: 0,
  uniquePeople: 0,
  byQuery: [],
}

/** Best-effort demand-capture aggregate; never throws (missing service role → empty). */
async function fetchDemandCaptureSafe(
  fromIso: string,
): Promise<SearchAnalyticsDashboard["demandCapture"]> {
  try {
    const service = createServiceRoleClient()
    return await aggregateDemandCaptureByQuery(service, fromIso)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[searchAnalytics] demand capture fetch failed:", msg)
    return EMPTY_DEMAND_CAPTURE
  }
}

const EMPTY_NAV_SEARCH_BAR: SearchAnalyticsDashboard["navSearchBar"] = {
  volumeByDay: [],
  totalFreeFormSubmits: 0,
  totalDropdownSelections: 0,
  topFreeFormQueries: [],
  recentEvents: [],
}

function mergeNavSearchBarRecentEvents(
  freeForm: NavBarMarketplaceKeywordEventHit[],
  dropdown: HeaderNavSuggestPickEventHit[],
): NavSearchBarEventLine[] {
  const lines: NavSearchBarEventLine[] = [
    ...freeForm.map((row) => ({
      id: `ff:${row.id}`,
      occurredAt: row.occurredAt,
      kind: "free_form" as const,
      query: row.queryDisplay,
      detail: null,
      resultCount: row.resultCount,
      pickKind: null,
    })),
    ...dropdown.map((row) => ({
      id: `dd:${row.id}`,
      occurredAt: row.occurredAt,
      kind: "dropdown" as const,
      query: row.queryPrefix,
      detail: row.selectionLabel,
      resultCount: null,
      pickKind: row.pickKind,
    })),
  ]
  lines.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  return lines.slice(0, NAV_SEARCH_BAR_RECENT_MERGED_CAP)
}

async function fetchNavSearchBarRecentEvents(
  from: string,
  to: string,
): Promise<NavSearchBarEventLine[]> {
  const [freeForm, dropdown] = await Promise.all([
    listNavBarMarketplaceKeywordEvents(from, to, NAV_SEARCH_BAR_RECENT_PER_SOURCE),
    listHeaderNavSuggestPickEvents(from, to, NAV_SEARCH_BAR_RECENT_PER_SOURCE),
  ])
  return mergeNavSearchBarRecentEvents(freeForm, dropdown)
}

function mergeNavSearchBarDaily(
  freeForm: { date: string; count: number }[],
  dropdown: { date: string; count: number }[],
): SearchAnalyticsDashboard["navSearchBar"]["volumeByDay"] {
  const keys = new Set<string>()
  const fm = new Map<string, number>()
  const dm = new Map<string, number>()
  for (const r of freeForm) {
    keys.add(r.date)
    fm.set(r.date, r.count)
  }
  for (const r of dropdown) {
    keys.add(r.date)
    dm.set(r.date, r.count)
  }
  return [...keys].sort().map((date) => ({
    date,
    freeFormSubmits: fm.get(date) ?? 0,
    dropdownSelections: dm.get(date) ?? 0,
  }))
}

function buildNavSearchBarSlice(
  navMp: Awaited<ReturnType<typeof aggregateNavBarMarketplaceKeywordAnalytics>>,
  navSuggest: Awaited<ReturnType<typeof aggregateHeaderNavSuggestClickAnalytics>>,
  recentEvents: NavSearchBarEventLine[],
): SearchAnalyticsDashboard["navSearchBar"] {
  const mp = navMp ?? { volumeByDay: [], topQueries: [], totalSubmits: 0 }
  const sg = navSuggest ?? { volumeByDay: [], totalClicks: 0 }
  return {
    volumeByDay: mergeNavSearchBarDaily(mp.volumeByDay, sg.volumeByDay),
    totalFreeFormSubmits: mp.totalSubmits,
    totalDropdownSelections: sg.totalClicks,
    topFreeFormQueries: mp.topQueries,
    recentEvents,
  }
}

/** Same momentum rules as the 2-day “Trending” card (growth vs trailing window). */
function computeTrendingFromMaps(
  recentMap: Map<string, number>,
  prevMap: Map<string, number>,
): SearchAnalyticsTrendingRow[] {
  const out: SearchAnalyticsTrendingRow[] = []
  for (const [query, recentCount] of recentMap) {
    if (recentCount < 2) continue
    const previousCount = prevMap.get(query) ?? 0
    const velocity = recentCount / (previousCount + 1)
    if (velocity >= 1.25 || (recentCount >= 5 && previousCount === 0)) {
      out.push({ query, recentCount, previousCount, velocity })
    }
  }
  out.sort((a, b) => b.velocity - a.velocity)
  return out
}

function utcInclusiveMonthBounds(yearMonth: string): {
  recentFrom: string
  recentTo: string
} {
  const m = /^(\d{4})-(\d{2})$/.exec(yearMonth.trim())
  if (!m) throw new Error("Invalid yearMonth")
  const y = Number(m[1])
  const mo = Number(m[2])
  if (!Number.isInteger(mo) || mo < 1 || mo > 12) throw new Error("Invalid yearMonth")
  const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999))
  return { recentFrom: start.toISOString(), recentTo: end.toISOString() }
}

/** Previous calendar month as yyyy-MM (UTC). */
function priorYearMonthUtc(yearMonth: string): string {
  const { recentFrom } = utcInclusiveMonthBounds(yearMonth)
  const d = new Date(recentFrom)
  d.setUTCMonth(d.getUTCMonth() - 1)
  const py = d.getUTCFullYear()
  const pm = d.getUTCMonth() + 1
  return `${py}-${String(pm).padStart(2, "0")}`
}

const TREND_RECENT_MS = 2 * 24 * 60 * 60 * 1000
const TREND_PREV_MS = 2 * 24 * 60 * 60 * 1000

export type SearchTrendPeriodMode = "all" | "month" | "window"

export type SearchTrendPeriodDetailPayload = {
  configured: boolean
  mode: SearchTrendPeriodMode
  yearMonth?: string
  /** Set when `mode === "window"` — rolling comparison size in days. */
  windowDays?: number
  recentLabel: string
  priorLabel: string
  trendingQueries: SearchAnalyticsTrendingRow[]
}

export async function getSearchTrendPeriodDetailService(
  mode: SearchTrendPeriodMode,
  yearMonth: string | undefined,
  windowDays?: number,
): Promise<SearchTrendPeriodDetailPayload> {
  if (!isElasticsearchConfigured()) {
    return {
      configured: false,
      mode,
      yearMonth,
      windowDays,
      recentLabel: "—",
      priorLabel: "—",
      trendingQueries: [],
    }
  }

  if (mode === "window") {
    const days = windowDays && windowDays > 0 ? windowDays : 30
    const end = new Date()
    const recentStart = new Date(end.getTime() - days * 86400000)
    const priorStart = new Date(recentStart.getTime() - days * 86400000)

    const df = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    })
    const recentLabel = `${df.format(recentStart)} – ${df.format(end)}`
    const priorLabel = `${df.format(priorStart)} – ${df.format(recentStart)}`

    try {
      const [recentMap, prevMap] = await Promise.all([
        topQueriesInRange(recentStart.toISOString(), end.toISOString(), 120),
        topQueriesInRange(priorStart.toISOString(), recentStart.toISOString(), 120, {
          endInclusive: false,
        }),
      ])
      return {
        configured: true,
        mode,
        windowDays: days,
        recentLabel,
        priorLabel,
        trendingQueries: computeTrendingFromMaps(recentMap, prevMap).slice(0, 40),
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error("getSearchTrendPeriodDetailService (window):", msg)
      return {
        configured: true,
        mode,
        windowDays: days,
        recentLabel,
        priorLabel,
        trendingQueries: [],
      }
    }
  }

  if (mode === "month") {
    if (!yearMonth) {
      return {
        configured: true,
        mode,
        recentLabel: "—",
        priorLabel: "—",
        trendingQueries: [],
      }
    }

    try {
      const prevYm = priorYearMonthUtc(yearMonth)
      const recentBm = utcInclusiveMonthBounds(yearMonth)
      const priorBm = utcInclusiveMonthBounds(prevYm)

      const [recentMap, prevMap] = await Promise.all([
        topQueriesInRange(recentBm.recentFrom, recentBm.recentTo, 120),
        topQueriesInRange(priorBm.recentFrom, priorBm.recentTo, 120),
      ])

      const monthLabelFormat = new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
      const recentLabel = monthLabelFormat.format(new Date(recentBm.recentFrom))
      const priorLabel = monthLabelFormat.format(new Date(priorBm.recentFrom))

      return {
        configured: true,
        mode,
        yearMonth,
        recentLabel,
        priorLabel,
        trendingQueries: computeTrendingFromMaps(recentMap, prevMap).slice(0, 40),
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error("getSearchTrendPeriodDetailService (month):", msg)
      return {
        configured: true,
        mode,
        yearMonth,
        recentLabel: "—",
        priorLabel: "—",
        trendingQueries: [],
      }
    }
  }

  const bounds = await getMarketplaceOccurredAtBounds()
  if (!bounds) {
    return {
      configured: true,
      mode,
      recentLabel: "—",
      priorLabel: "—",
      trendingQueries: [],
    }
  }

  const minMs = Date.parse(bounds.minIso)
  const maxMs = Date.parse(bounds.maxIso)
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || maxMs <= minMs) {
    return {
      configured: true,
      mode,
      recentLabel: "—",
      priorLabel: "—",
      trendingQueries: [],
    }
  }

  const midIso = new Date(Math.floor(minMs + (maxMs - minMs) / 2)).toISOString()
  const dfShort = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
  const priorLabel = `${dfShort.format(new Date(bounds.minIso))} – ${dfShort.format(new Date(midIso))}`
  const recentLabel = `${dfShort.format(new Date(midIso))} – ${dfShort.format(new Date(bounds.maxIso))}`

  try {
    const [recentMap, prevMap] = await Promise.all([
      topQueriesInRange(midIso, bounds.maxIso, 120),
      topQueriesInRange(bounds.minIso, midIso, 120, { endInclusive: false }),
    ])

    return {
      configured: true,
      mode,
      recentLabel,
      priorLabel,
      trendingQueries: computeTrendingFromMaps(recentMap, prevMap).slice(0, 40),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("getSearchTrendPeriodDetailService (all):", msg)
    return {
      configured: true,
      mode,
      recentLabel,
      priorLabel,
      trendingQueries: [],
    }
  }
}

// ---------------------------------------------------------------------------
// Headline metrics + insights engine (business recommendations)
// ---------------------------------------------------------------------------

function pct(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return `${(n * 100).toFixed(digits)}%`
}

function backendShare(byBackend: { backend: string; count: number }[], backend: string): number | null {
  const total = byBackend.reduce((s, b) => s + b.count, 0)
  if (total <= 0) return null
  const match = byBackend.find((b) => b.backend === backend)?.count ?? 0
  return match / total
}

function computeVolumeMomentum(volumeByDay: { date: string; count: number }[]): number | null {
  if (volumeByDay.length < 4) return null
  const mid = Math.floor(volumeByDay.length / 2)
  const firstHalf = volumeByDay.slice(0, mid).reduce((s, d) => s + d.count, 0)
  const secondHalf = volumeByDay.slice(mid).reduce((s, d) => s + d.count, 0)
  if (firstHalf <= 0) return secondHalf > 0 ? 1 : null
  return (secondHalf - firstHalf) / firstHalf
}

function computeSearchHeadline(base: SearchAnalyticsDashboardBase): SearchAnalyticsHeadline {
  const typeaheadEngagementRate =
    base.totalSearches > 0 ? base.suggestPickTotal / base.totalSearches : null
  const databaseFallbackShare = backendShare(base.byBackend, "supabase")
  const volumeMomentum = computeVolumeMomentum(base.volumeByDay)
  const unmetDemandSearches =
    base.zeroResultSearchShare != null
      ? Math.round(base.zeroResultSearchShare * base.totalSearches)
      : 0
  const navTotal =
    base.navSearchBar.totalFreeFormSubmits + base.navSearchBar.totalDropdownSelections
  const navDropdownShare = navTotal > 0 ? base.navSearchBar.totalDropdownSelections / navTotal : null

  return {
    typeaheadEngagementRate,
    databaseFallbackShare,
    volumeMomentum,
    unmetDemandSearches,
    navDropdownShare,
    actionableInsightCount: 0,
  }
}

/**
 * Turns the raw aggregates into a prioritized list of plain-language insights,
 * each paired with a concrete recommended action. Pure + deterministic so it
 * stays testable and renders identically on every refresh.
 */
function buildSearchInsights(
  base: SearchAnalyticsDashboardBase,
  headline: SearchAnalyticsHeadline,
): SearchInsight[] {
  const out: SearchInsight[] = []

  if (!base.configured) {
    out.push({
      id: "not-configured",
      severity: "critical",
      category: "infrastructure",
      title: "Search analytics isn’t collecting data",
      finding: "Elasticsearch isn’t configured, so no marketplace search events are being recorded.",
      action:
        "Set the Elasticsearch cluster URL and credentials. Until then you’re flying blind on what shoppers search for.",
    })
    return out
  }

  if (base.totalSearches === 0) {
    out.push({
      id: "no-traffic",
      severity: "warning",
      category: "growth",
      title: "No searches recorded in this range",
      finding: "Either tracking isn’t firing or there’s no search traffic in the selected window.",
      action:
        "Confirm the search-tracking call fires on /search, then widen the range or drive traffic to the marketplace.",
    })
    return out
  }

  const total = base.totalSearches
  const zeroShare = base.zeroResultSearchShare
  const topZero = base.zeroResultQueries.slice(0, 5)

  // --- Zero-result demand ----------------------------------------------------
  if (zeroShare != null && zeroShare >= 0.08) {
    const severity: SearchInsightSeverity = zeroShare >= 0.2 ? "critical" : "warning"
    out.push({
      id: "zero-result-share",
      severity,
      category: "demand",
      title:
        zeroShare >= 0.2
          ? "1 in 5 searches finds nothing"
          : "Many searches return zero results",
      finding: `${pct(zeroShare)} of ${total.toLocaleString()} searches returned no listings — roughly ${headline.unmetDemandSearches.toLocaleString()} shoppers hit a dead end.`,
      action:
        "Add supply or search synonyms for the empty queries below, and add a “notify me when listed” capture on the no-results screen to convert that demand.",
      impact: "Unmet demand is the fastest source of new GMV — each fix recovers shoppers already looking.",
      metricLabel: "Zero-result",
      metricValue: pct(zeroShare),
      examples: topZero.map((q) => `${q.query} (${q.count})`),
    })
  } else if (zeroShare != null && total >= 50 && zeroShare < 0.03) {
    out.push({
      id: "zero-result-healthy",
      severity: "positive",
      category: "demand",
      title: "Excellent search coverage",
      finding: `Only ${pct(zeroShare)} of searches return nothing — inventory matches demand well.`,
      action: "Keep an eye on trending queries below so coverage stays ahead of new demand.",
      metricLabel: "Zero-result",
      metricValue: pct(zeroShare),
    })
  }

  // --- Standout single unmet query ------------------------------------------
  const standoutZero = topZero[0]
  if (standoutZero && standoutZero.count >= Math.max(8, total * 0.01)) {
    out.push({
      id: `zero-query-${standoutZero.query}`,
      severity: "opportunity",
      category: "inventory",
      title: `Unmet demand: “${standoutZero.query}”`,
      finding: `Searched ${standoutZero.count.toLocaleString()} times in this range with zero results.`,
      action:
        "Recruit a seller or add this brand/model to the catalog. If it exists under another spelling, add a search synonym so it resolves.",
      examples: topZero.slice(1, 4).map((q) => `${q.query} (${q.count})`),
    })
  }

  // --- Trending / rising demand ---------------------------------------------
  if (base.trendingQueries.length > 0) {
    const top = base.trendingQueries.slice(0, 3)
    out.push({
      id: "trending-demand",
      severity: "opportunity",
      category: "growth",
      title: "Rising search demand to capitalize on",
      finding: "These queries are accelerating versus the prior window.",
      action:
        "Feature them on the homepage/category strips, make sure inventory is in stock, and consider an email or social push while interest is hot.",
      examples: top.map((t) => `${t.query} (${t.velocity.toFixed(1)}×, ${t.recentCount} recent)`),
    })
  }

  // --- Infrastructure: database fallback ------------------------------------
  if (headline.databaseFallbackShare != null && headline.databaseFallbackShare >= 0.25) {
    out.push({
      id: "db-fallback",
      severity: headline.databaseFallbackShare >= 0.5 ? "critical" : "warning",
      category: "infrastructure",
      title: "Search is falling back to the database",
      finding: `${pct(headline.databaseFallbackShare)} of searches were served by the slower database path instead of Elasticsearch.`,
      action:
        "Check Elasticsearch health and indexing. The DB fallback is slower and less relevant, which directly suppresses search-to-purchase conversion.",
      metricLabel: "DB fallback",
      metricValue: pct(headline.databaseFallbackShare),
    })
  }

  // --- Query concentration ---------------------------------------------------
  if (base.queryConcentration != null && base.queryConcentration >= 0.15) {
    out.push({
      id: "demand-concentration",
      severity: "opportunity",
      category: "demand",
      title: "Demand is concentrated in a few terms",
      finding: `Top queries dominate volume (concentration index ${base.queryConcentration.toFixed(2)}).`,
      action:
        "Give your top search terms deep inventory, curated landing pages, and strong merchandising — small improvements here move the most volume.",
      examples: base.topQueries.slice(0, 4).map((q) => `${q.query} (${q.count})`),
    })
  }

  // --- Average result count (relevance / inventory) -------------------------
  if (base.avgResultCount != null && base.avgResultCount > 80) {
    out.push({
      id: "too-many-results",
      severity: "opportunity",
      category: "relevance",
      title: "Searches return a flood of results",
      finding: `The average search returns ${base.avgResultCount.toFixed(0)} listings.`,
      action:
        "Tighten ranking and add filters (size, condition, price, location) so the best matches surface first — fewer scrolls, less abandonment.",
      metricLabel: "Avg results",
      metricValue: base.avgResultCount.toFixed(0),
    })
  } else if (base.avgResultCount != null && total >= 50 && base.avgResultCount < 6) {
    out.push({
      id: "thin-results",
      severity: "warning",
      category: "inventory",
      title: "Result sets are thin",
      finding: `The average search returns only ${base.avgResultCount.toFixed(1)} listings.`,
      action:
        "Grow supply in the most-searched categories. Thin results limit buyer choice and depress conversion.",
      metricLabel: "Avg results",
      metricValue: base.avgResultCount.toFixed(1),
    })
  }

  // --- Volume momentum -------------------------------------------------------
  if (headline.volumeMomentum != null && headline.volumeMomentum <= -0.2) {
    out.push({
      id: "volume-down",
      severity: "warning",
      category: "growth",
      title: "Search volume is declining",
      finding: `Down ${pct(Math.abs(headline.volumeMomentum))} comparing the second half of the range to the first.`,
      action:
        "Review SEO/marketing and seasonality, and consider a re-engagement campaign to bring shoppers back.",
      metricLabel: "Momentum",
      metricValue: `-${pct(Math.abs(headline.volumeMomentum))}`,
    })
  } else if (headline.volumeMomentum != null && headline.volumeMomentum >= 0.25) {
    out.push({
      id: "volume-up",
      severity: "positive",
      category: "growth",
      title: "Search volume is growing",
      finding: `Up ${pct(headline.volumeMomentum)} comparing the second half of the range to the first.`,
      action: "Capitalize — keep inventory and merchandising ahead of rising demand.",
      metricLabel: "Momentum",
      metricValue: `+${pct(headline.volumeMomentum)}`,
    })
  }

  // --- Brand directory: demand for unlisted brands --------------------------
  const bdZero = base.brandDirectory.zeroResultQueries.slice(0, 5)
  if (bdZero.length > 0 && (bdZero[0]?.count ?? 0) >= 3) {
    out.push({
      id: "brand-directory-unmet",
      severity: "opportunity",
      category: "inventory",
      title: "Brands shoppers want that aren’t in the directory",
      finding: "These brand-directory searches returned no brand — a direct demand signal.",
      action:
        "Add these brands in the Brand catalog explorer or recruit them. Listing a brand page captures the demand and helps SEO.",
      examples: bdZero.map((q) => `${q.query} (${q.count})`),
    })
  }

  // --- Typeahead engagement --------------------------------------------------
  if (
    total >= 100 &&
    headline.typeaheadEngagementRate != null &&
    headline.typeaheadEngagementRate < 0.08
  ) {
    out.push({
      id: "low-typeahead",
      severity: "opportunity",
      category: "engagement",
      title: "Few shoppers use typeahead suggestions",
      finding: `Only ${pct(headline.typeaheadEngagementRate)} of searches end in a suggestion click.`,
      action:
        "Improve suggestion relevance and coverage (brands, categories, top listings) and surface more rows so shoppers reach a match faster.",
      metricLabel: "Typeahead use",
      metricValue: pct(headline.typeaheadEngagementRate),
    })
  }

  // --- Typeahead hover-without-pick friction --------------------------------
  if (
    base.suggestHoverTotal >= 50 &&
    base.suggestPickTotal / (base.suggestHoverTotal || 1) < 0.3
  ) {
    out.push({
      id: "suggest-friction",
      severity: "warning",
      category: "engagement",
      title: "Suggestions get seen but not clicked",
      finding: "High hover-to-click drop-off in the typeahead dropdown.",
      action:
        "Re-rank suggestions — the top rows likely don’t match intent. Promote the kinds (brands/listings) that do get clicked.",
    })
  }

  out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
  return out.slice(0, 12)
}

function finalizeDashboard(base: SearchAnalyticsDashboardBase): SearchAnalyticsDashboard {
  const headline = computeSearchHeadline(base)
  const insights = buildSearchInsights(base, headline)
  headline.actionableInsightCount = insights.filter((i) => i.severity !== "positive").length
  return { ...base, headline, insights }
}

export async function getSearchAnalyticsDashboardService(
  rangeDays: number,
): Promise<SearchAnalyticsDashboard> {
  const fetchedAt = new Date().toISOString()

  if (!isElasticsearchConfigured()) {
    return finalizeDashboard({
      configured: false,
      rangeDays,
      from: "",
      to: "",
      totalSearches: 0,
      uniqueQueriesApprox: 0,
      avgResultCount: null,
      zeroResultSearchShare: null,
      queryConcentration: null,
      resultCountStats: { min: null, max: null, stdDeviation: null },
      resultCountDistribution: [],
      categoryFilterSplit: [],
      topCategorySlugs: [],
      volumeByDay: [],
      hourOfDay: [],
      topQueries: [],
      zeroResultQueries: [],
      byBackend: [],
      trendingQueries: [],
      suggestPickTotal: 0,
      suggestHoverTotal: 0,
      suggestPicksByKind: [],
      suggestPicksByTrace: [],
      suggestHoversByKind: [],
      suggestTopQueryPrefixes: [],
      suggestTopQueryPrefixesHover: [],
      suggestTopListingClicks: [],
      brandDirectory: EMPTY_BRAND_DIRECTORY_DASH,
      navSearchBar: EMPTY_NAV_SEARCH_BAR,
      demandCapture: EMPTY_DEMAND_CAPTURE,
      fetchedAt,
    })
  }

  const end = new Date()
  const start = new Date(end.getTime() - rangeDays * 86400000)
  const from = start.toISOString()
  const to = end.toISOString()

  const [main, suggestPicks, navMp, navSuggest, navRecentEvents, hourOfDay, demandCapture] =
    await Promise.all([
      aggregateSearchAnalytics(from, to),
      aggregateSearchSuggestPicks(from, to),
      aggregateNavBarMarketplaceKeywordAnalytics(from, to),
      aggregateHeaderNavSuggestClickAnalytics(from, to),
      fetchNavSearchBarRecentEvents(from, to),
      aggregateMarketplaceHourOfDay(from, to),
      fetchDemandCaptureSafe(from),
    ])

  const navSearchBar = buildNavSearchBarSlice(navMp, navSuggest, navRecentEvents)

  if (!main) {
    return finalizeDashboard({
      configured: true,
      rangeDays,
      from,
      to,
      totalSearches: 0,
      uniqueQueriesApprox: 0,
      avgResultCount: null,
      zeroResultSearchShare: null,
      queryConcentration: null,
      resultCountStats: { min: null, max: null, stdDeviation: null },
      resultCountDistribution: [],
      categoryFilterSplit: [],
      topCategorySlugs: [],
      volumeByDay: [],
      hourOfDay,
      topQueries: [],
      zeroResultQueries: [],
      byBackend: [],
      trendingQueries: [],
      suggestPickTotal: suggestPicks?.totalClicks ?? 0,
      suggestHoverTotal: suggestPicks?.totalHovers ?? 0,
      suggestPicksByKind: suggestPicks?.byKind ?? [],
      suggestPicksByTrace: suggestPicks?.byTrace ?? [],
      suggestHoversByKind: suggestPicks?.hoverByKind ?? [],
      suggestTopQueryPrefixes: suggestPicks?.topQueryPrefixesClicks ?? [],
      suggestTopQueryPrefixesHover: suggestPicks?.topQueryPrefixesHovers ?? [],
      suggestTopListingClicks: suggestPicks?.topListingClicks ?? [],
      brandDirectory: EMPTY_BRAND_DIRECTORY_DASH,
      navSearchBar,
      demandCapture,
      fetchedAt,
    })
  }

  const zeroShare =
    main.totalSearches > 0 ? main.zeroResultEventCount / main.totalSearches : null

  const top20 = main.topQueries.slice(0, 20)
  const top20Sum = top20.reduce((s, q) => s + q.count, 0)
  const queryConcentration =
    main.totalSearches > 0 && top20Sum > 0
      ? top20.reduce((s, q) => s + (q.count / main.totalSearches) ** 2, 0)
      : null

  const recentStart = new Date(end.getTime() - TREND_RECENT_MS)
  const prevEnd = recentStart
  const prevStart = new Date(prevEnd.getTime() - TREND_PREV_MS)

  const [recentMap, prevMap] = await Promise.all([
    topQueriesInRange(recentStart.toISOString(), end.toISOString(), 80),
    topQueriesInRange(prevStart.toISOString(), prevEnd.toISOString(), 80),
  ])

  const trendingTop = computeTrendingFromMaps(recentMap, prevMap).slice(0, 20)

  const bd = main.brandDirectory
  const bdZeroShare =
    bd.totalSearches > 0 ? bd.zeroResultEventCount / bd.totalSearches : null

  return finalizeDashboard({
    configured: true,
    rangeDays,
    from,
    to,
    totalSearches: main.totalSearches,
    uniqueQueriesApprox: main.uniqueQueriesApprox,
    avgResultCount: main.avgResultCount,
    zeroResultSearchShare: zeroShare,
    queryConcentration,
    resultCountStats: main.resultCountStats,
    resultCountDistribution: main.resultCountDistribution,
    categoryFilterSplit: main.categoryFilterSplit,
    topCategorySlugs: main.topCategorySlugs,
    volumeByDay: main.volumeByDay,
    hourOfDay,
    topQueries: main.topQueries,
    zeroResultQueries: main.zeroResultQueries,
    byBackend: main.byBackend,
    trendingQueries: trendingTop,
    suggestPickTotal: suggestPicks?.totalClicks ?? 0,
    suggestHoverTotal: suggestPicks?.totalHovers ?? 0,
    suggestPicksByKind: suggestPicks?.byKind ?? [],
    suggestPicksByTrace: suggestPicks?.byTrace ?? [],
    suggestHoversByKind: suggestPicks?.hoverByKind ?? [],
    suggestTopQueryPrefixes: suggestPicks?.topQueryPrefixesClicks ?? [],
    suggestTopQueryPrefixesHover: suggestPicks?.topQueryPrefixesHovers ?? [],
    suggestTopListingClicks: suggestPicks?.topListingClicks ?? [],
    brandDirectory: {
      totalSearches: bd.totalSearches,
      uniqueQueriesApprox: bd.uniqueQueriesApprox,
      avgResultCount: bd.avgResultCount,
      zeroResultSearchShare: bdZeroShare,
      volumeByDay: bd.volumeByDay,
      topQueries: bd.topQueries,
      zeroResultQueries: bd.zeroResultQueries,
      byBackend: bd.byBackend,
    },
    navSearchBar,
    demandCapture,
    fetchedAt,
  })
}
