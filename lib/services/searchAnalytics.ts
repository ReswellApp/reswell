import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import {
  aggregateSearchAnalytics,
  indexSearchAnalyticsDocument,
  topQueriesInRange,
  type SearchAnalyticsDoc,
} from "@/lib/elasticsearch/search-analytics-index"
import {
  aggregateSearchSuggestPicks,
  indexSearchSuggestPickDocument,
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

const TREND_RECENT_MS = 2 * 24 * 60 * 60 * 1000
const TREND_PREV_MS = 2 * 24 * 60 * 60 * 1000

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
      fetchedAt,
    }
  }

  const end = new Date()
  const start = new Date(end.getTime() - rangeDays * 86400000)
  const from = start.toISOString()
  const to = end.toISOString()

  const [main, suggestPicks] = await Promise.all([
    aggregateSearchAnalytics(from, to),
    aggregateSearchSuggestPicks(from, to),
  ])

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

  const trendingQueries: SearchAnalyticsTrendingRow[] = []
  for (const [query, recentCount] of recentMap) {
    if (recentCount < 2) continue
    const previousCount = prevMap.get(query) ?? 0
    const velocity = recentCount / (previousCount + 1)
    if (velocity >= 1.25 || (recentCount >= 5 && previousCount === 0)) {
      trendingQueries.push({ query, recentCount, previousCount, velocity })
    }
  }
  trendingQueries.sort((a, b) => b.velocity - a.velocity)
  const trendingTop = trendingQueries.slice(0, 20)

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
    fetchedAt,
  }
}
