import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import {
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
  fetchedAt: string
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

export type SearchTrendPeriodDetailPayload = {
  configured: boolean
  mode: "all" | "month"
  yearMonth?: string
  recentLabel: string
  priorLabel: string
  trendingQueries: SearchAnalyticsTrendingRow[]
}

export async function getSearchTrendPeriodDetailService(
  mode: "all" | "month",
  yearMonth: string | undefined,
): Promise<SearchTrendPeriodDetailPayload> {
  if (!isElasticsearchConfigured()) {
    return {
      configured: false,
      mode,
      yearMonth,
      recentLabel: "—",
      priorLabel: "—",
      trendingQueries: [],
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

export async function getSearchAnalyticsDashboardService(
  rangeDays: number,
): Promise<SearchAnalyticsDashboard> {
  const fetchedAt = new Date().toISOString()

  if (!isElasticsearchConfigured()) {
    return {
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
      fetchedAt,
    }
  }

  const end = new Date()
  const start = new Date(end.getTime() - rangeDays * 86400000)
  const from = start.toISOString()
  const to = end.toISOString()

  const [main, suggestPicks, navMp, navSuggest, navRecentEvents] = await Promise.all([
    aggregateSearchAnalytics(from, to),
    aggregateSearchSuggestPicks(from, to),
    aggregateNavBarMarketplaceKeywordAnalytics(from, to),
    aggregateHeaderNavSuggestClickAnalytics(from, to),
    fetchNavSearchBarRecentEvents(from, to),
  ])

  const navSearchBar = buildNavSearchBarSlice(navMp, navSuggest, navRecentEvents)

  if (!main) {
    return {
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
      fetchedAt,
    }
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

  return {
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
    fetchedAt,
  }
}
