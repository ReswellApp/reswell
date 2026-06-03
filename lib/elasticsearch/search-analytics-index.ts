import { getElasticsearchClient } from "./client"
import { ELASTICSEARCH_SEARCH_ANALYTICS_INDEX } from "./config"

const RESULT_COUNT_BANDS = ["0", "1-5", "6-15", "16+"] as const

function emptyDistribution(): { band: string; count: number }[] {
  return RESULT_COUNT_BANDS.map((band) => ({ band, count: 0 }))
}

const INDEX_MAPPINGS = {
  properties: {
    occurred_at: { type: "date" as const },
    query_normalized: { type: "keyword" as const, ignore_above: 512 },
    query_display: { type: "keyword" as const, ignore_above: 512 },
    result_count: { type: "integer" as const },
    backend: { type: "keyword" as const },
    /** `marketplace` = /search listing search; `brand_directory` = /brands catalog typeahead. */
    search_surface: { type: "keyword" as const },
    /** Keyword search submitted from header nav (`nq=1` on first paint — stripped client-side). */
    origin_surface: { type: "keyword" as const },
    category_slug: { type: "keyword" as const },
    has_category_filter: { type: "boolean" as const },
  },
}

export type SearchAnalyticsSurface = "marketplace" | "brand_directory"

export type SearchAnalyticsDoc = {
  occurred_at: string
  query_normalized: string
  query_display: string
  result_count: number
  backend: "elasticsearch" | "supabase"
  search_surface: SearchAnalyticsSurface
  /** When set, keyword `/search` load was attributed to header nav (`nq=1`). */
  origin_surface?: "header_nav"
  category_slug: string | null
  has_category_filter: boolean
}

/** Legacy docs omit `search_surface`; treat as marketplace listing search. */
const MARKETPLACE_SURFACE_FILTER = {
  bool: {
    should: [
      { term: { search_surface: "marketplace" } },
      { bool: { must_not: { exists: { field: "search_surface" } } } },
    ],
    minimum_should_match: 1,
  },
}

export async function ensureSearchAnalyticsIndex(): Promise<boolean> {
  const es = getElasticsearchClient()
  if (!es) return false

  try {
    const exists = await es.indices.exists({ index: ELASTICSEARCH_SEARCH_ANALYTICS_INDEX })
    if (!exists) {
      await es.indices.create({
        index: ELASTICSEARCH_SEARCH_ANALYTICS_INDEX,
        mappings: INDEX_MAPPINGS,
      })
    } else {
      try {
        await es.indices.putMapping({
          index: ELASTICSEARCH_SEARCH_ANALYTICS_INDEX,
          properties: {
            search_surface: { type: "keyword" },
            origin_surface: { type: "keyword" },
          },
        })
      } catch {
        // Field may already exist.
      }
    }
    return true
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] ensureSearchAnalyticsIndex failed:", msg)
    return false
  }
}

export async function indexSearchAnalyticsDocument(doc: SearchAnalyticsDoc): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  const ready = await ensureSearchAnalyticsIndex()
  if (!ready) return

  try {
    await es.index({
      index: ELASTICSEARCH_SEARCH_ANALYTICS_INDEX,
      document: doc,
      // Make events visible to aggregations immediately (low volume; avoids “refresh and still empty”).
      refresh: true,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] indexSearchAnalyticsDocument failed:", msg)
  }
}

export type SearchAnalyticsAggregateResult = {
  totalSearches: number
  uniqueQueriesApprox: number
  avgResultCount: number | null
  /** Count of logged searches where `result_count` was 0. */
  zeroResultEventCount: number
  /** Min / max / stddev of listing counts returned (sample stats). */
  resultCountStats: {
    min: number | null
    max: number | null
    stdDeviation: number | null
  }
  /** Searches grouped by how many listings matched. */
  resultCountDistribution: { band: string; count: number }[]
  /** Logged searches with a category filter vs open surfboard search. */
  categoryFilterSplit: { key: string; count: number }[]
  /** Non-empty category slugs only; capped list. */
  topCategorySlugs: { slug: string; count: number }[]
  volumeByDay: { date: string; count: number }[]
  topQueries: { query: string; count: number }[]
  zeroResultQueries: { query: string; count: number }[]
  byBackend: { backend: string; count: number }[]
  /** `/brands` directory searches (`searchBrandsCatalogSuggest` pipeline). */
  brandDirectory: {
    totalSearches: number
    uniqueQueriesApprox: number
    avgResultCount: number | null
    zeroResultEventCount: number
    volumeByDay: { date: string; count: number }[]
    topQueries: { query: string; count: number }[]
    zeroResultQueries: { query: string; count: number }[]
    byBackend: { backend: string; count: number }[]
  }
}

function emptyBrandDirectoryAgg(): SearchAnalyticsAggregateResult["brandDirectory"] {
  return {
    totalSearches: 0,
    uniqueQueriesApprox: 0,
    avgResultCount: null,
    zeroResultEventCount: 0,
    volumeByDay: [],
    topQueries: [],
    zeroResultQueries: [],
    byBackend: [],
  }
}

function bucketTerms(
  buckets: Array<{ key: string | number; doc_count: number }> | undefined,
): { query: string; count: number }[] {
  if (!buckets?.length) return []
  return buckets.map((b) => ({
    query: String(b.key),
    count: b.doc_count,
  }))
}

export async function aggregateSearchAnalytics(
  fromIso: string,
  toIso: string,
): Promise<SearchAnalyticsAggregateResult | null> {
  const es = getElasticsearchClient()
  if (!es) return null

  try {
    const dateHistogram = {
      date_histogram: {
        field: "occurred_at",
        calendar_interval: "day" as const,
        min_doc_count: 0,
        extended_bounds: { min: fromIso, max: toIso },
      },
    }

    const res = await es.search({
      index: ELASTICSEARCH_SEARCH_ANALYTICS_INDEX,
      size: 0,
      track_total_hits: true,
      query: {
        bool: {
          filter: [{ range: { occurred_at: { gte: fromIso, lte: toIso } } }],
        },
      },
      aggs: {
        marketplace: {
          filter: MARKETPLACE_SURFACE_FILTER,
          aggs: {
            unique_queries: {
              cardinality: { field: "query_normalized", precision_threshold: 4000 },
            },
            avg_results: {
              avg: { field: "result_count" },
            },
            by_day: dateHistogram,
            top_queries: {
              terms: { field: "query_normalized", size: 50, order: { _count: "desc" } },
            },
            zero_hits: {
              filter: { term: { result_count: 0 } },
              aggs: {
                zq: {
                  terms: { field: "query_normalized", size: 30, order: { _count: "desc" } },
                },
              },
            },
            backends: {
              terms: { field: "backend", size: 10 },
            },
            result_stats: {
              extended_stats: { field: "result_count" },
            },
            result_buckets: {
              range: {
                field: "result_count",
                keyed: true,
                ranges: [
                  { key: "0", to: 1 },
                  { key: "1-5", from: 1, to: 6 },
                  { key: "6-15", from: 6, to: 16 },
                  { key: "16+", from: 16 },
                ],
              },
            },
            category_filter: {
              terms: { field: "has_category_filter", size: 4 },
            },
            top_categories: {
              terms: { field: "category_slug", size: 12, missing: "__none__" },
            },
          },
        },
        brand_directory: {
          filter: { term: { search_surface: "brand_directory" } },
          aggs: {
            unique_queries: {
              cardinality: { field: "query_normalized", precision_threshold: 4000 },
            },
            avg_results: {
              avg: { field: "result_count" },
            },
            by_day: dateHistogram,
            top_queries: {
              terms: { field: "query_normalized", size: 30, order: { _count: "desc" } },
            },
            backends: {
              terms: { field: "backend", size: 6 },
            },
            zero_hits: {
              filter: { term: { result_count: 0 } },
              aggs: {
                zq: {
                  terms: { field: "query_normalized", size: 20, order: { _count: "desc" } },
                },
              },
            },
          },
        },
      },
    })

    const aggs = res.aggregations as Record<string, unknown> | undefined
    const mp = aggs?.marketplace as Record<string, unknown> | undefined
    const bd = aggs?.brand_directory as Record<string, unknown> | undefined

    const uniqueRaw = mp?.unique_queries as { value?: number } | undefined
    const avgRaw = mp?.avg_results as { value?: number | null } | undefined
    const byDayRaw = mp?.by_day as
      | { buckets?: Array<{ key_as_string?: string; doc_count: number }> }
      | undefined
    const topRaw = mp?.top_queries as
      | { buckets?: Array<{ key: string | number; doc_count: number }> }
      | undefined
    const zeroRaw = mp?.zero_hits as
      | {
          doc_count?: number
          zq?: { buckets?: Array<{ key: string | number; doc_count: number }> }
        }
      | undefined
    const backendsRaw = mp?.backends as
      | { buckets?: Array<{ key: string | number; doc_count: number }> }
      | undefined
    const extStatsRaw = mp?.result_stats as
      | {
          min?: number | null
          max?: number | null
          std_deviation?: number | null
        }
      | undefined
    const rangeBucketsRaw = mp?.result_buckets as
      | { buckets?: Record<string, { doc_count: number }> }
      | undefined
    const catFilterRaw = mp?.category_filter as
      | { buckets?: Array<{ key: string | number; doc_count: number }> }
      | undefined
    const topCatRaw = mp?.top_categories as
      | { buckets?: Array<{ key: string | number; doc_count: number }> }
      | undefined

    const mpDocCount = typeof mp?.doc_count === "number" ? mp.doc_count : 0

    const bdUnique = bd?.unique_queries as { value?: number } | undefined
    const bdAvg = bd?.avg_results as { value?: number | null } | undefined
    const bdByDay = bd?.by_day as
      | { buckets?: Array<{ key_as_string?: string; doc_count: number }> }
      | undefined
    const bdTop = bd?.top_queries as
      | { buckets?: Array<{ key: string | number; doc_count: number }> }
      | undefined
    const bdBackends = bd?.backends as
      | { buckets?: Array<{ key: string | number; doc_count: number }> }
      | undefined
    const bdZero = bd?.zero_hits as
      | {
          doc_count?: number
          zq?: { buckets?: Array<{ key: string | number; doc_count: number }> }
        }
      | undefined
    const bdDocCount = typeof bd?.doc_count === "number" ? bd.doc_count : 0

    const rb = rangeBucketsRaw?.buckets ?? {}
    const resultCountDistribution: { band: string; count: number }[] =
      RESULT_COUNT_BANDS.map((band) => ({
        band,
        count: rb[band]?.doc_count ?? 0,
      }))

    return {
      totalSearches: mpDocCount,
      uniqueQueriesApprox: uniqueRaw?.value ?? 0,
      avgResultCount:
        avgRaw?.value != null && Number.isFinite(avgRaw.value) ? avgRaw.value : null,
      zeroResultEventCount: zeroRaw?.doc_count ?? 0,
      resultCountStats: {
        min:
          extStatsRaw?.min != null && Number.isFinite(extStatsRaw.min)
            ? extStatsRaw.min
            : null,
        max:
          extStatsRaw?.max != null && Number.isFinite(extStatsRaw.max)
            ? extStatsRaw.max
            : null,
        stdDeviation:
          extStatsRaw?.std_deviation != null &&
          Number.isFinite(extStatsRaw.std_deviation)
            ? extStatsRaw.std_deviation
            : null,
      },
      resultCountDistribution,
      categoryFilterSplit: (catFilterRaw?.buckets ?? []).map((b) => {
        const k = b.key
        const isFiltered =
          k === 1 ||
          k === "true" ||
          String(k).toLowerCase() === "true"
        return {
          key: isFiltered ? "category_filter" : "open_search",
          count: b.doc_count,
        }
      }),
      topCategorySlugs: (topCatRaw?.buckets ?? [])
        .filter((b) => String(b.key) !== "__none__")
        .map((b) => ({ slug: String(b.key), count: b.doc_count })),
      volumeByDay: (byDayRaw?.buckets ?? []).map((b) => ({
        date: (b.key_as_string ?? "").slice(0, 10),
        count: b.doc_count,
      })),
      topQueries: bucketTerms(topRaw?.buckets),
      zeroResultQueries: bucketTerms(zeroRaw?.zq?.buckets),
      byBackend: (backendsRaw?.buckets ?? []).map((b) => ({
        backend: String(b.key),
        count: b.doc_count,
      })),
      brandDirectory: {
        totalSearches: bdDocCount,
        uniqueQueriesApprox: bdUnique?.value ?? 0,
        avgResultCount:
          bdAvg?.value != null && Number.isFinite(bdAvg.value) ? bdAvg.value : null,
        zeroResultEventCount: bdZero?.doc_count ?? 0,
        volumeByDay: (bdByDay?.buckets ?? []).map((b) => ({
          date: (b.key_as_string ?? "").slice(0, 10),
          count: b.doc_count,
        })),
        topQueries: bucketTerms(bdTop?.buckets),
        zeroResultQueries: bucketTerms(bdZero?.zq?.buckets),
        byBackend: (bdBackends?.buckets ?? []).map((b) => ({
          backend: String(b.key),
          count: b.doc_count,
        })),
      },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode
    if (status === 404) {
      return {
        totalSearches: 0,
        uniqueQueriesApprox: 0,
        avgResultCount: null,
        zeroResultEventCount: 0,
        resultCountStats: { min: null, max: null, stdDeviation: null },
        resultCountDistribution: emptyDistribution(),
        categoryFilterSplit: [],
        topCategorySlugs: [],
        volumeByDay: [],
        topQueries: [],
        zeroResultQueries: [],
        byBackend: [],
        brandDirectory: emptyBrandDirectoryAgg(),
      }
    }
    console.error("[elasticsearch] aggregateSearchAnalytics failed:", msg)
    return null
  }
}

/**
 * Marketplace searches grouped by UTC hour-of-day (0–23), folded across every
 * day in the range. Runs as an isolated query with a scripted terms agg so a
 * scripting failure can never take down the main dashboard aggregation.
 */
export async function aggregateMarketplaceHourOfDay(
  fromIso: string,
  toIso: string,
): Promise<{ hour: number; count: number }[]> {
  const es = getElasticsearchClient()
  if (!es) return []

  try {
    const res = await es.search({
      index: ELASTICSEARCH_SEARCH_ANALYTICS_INDEX,
      size: 0,
      query: {
        bool: {
          filter: [
            { range: { occurred_at: { gte: fromIso, lte: toIso } } },
            MARKETPLACE_SURFACE_FILTER as unknown as Record<string, unknown>,
          ],
        },
      },
      aggs: {
        by_hour: {
          terms: {
            script: {
              source: "doc['occurred_at'].value.getHour()",
              lang: "painless",
            },
            size: 24,
            order: { _key: "asc" },
          },
        },
      },
    })

    const aggs = res.aggregations as
      | { by_hour?: { buckets?: Array<{ key: string | number; doc_count: number }> } }
      | undefined

    const counts = new Map<number, number>()
    for (const b of aggs?.by_hour?.buckets ?? []) {
      const hour = typeof b.key === "number" ? b.key : Number(b.key)
      if (Number.isInteger(hour) && hour >= 0 && hour <= 23) {
        counts.set(hour, b.doc_count)
      }
    }

    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: counts.get(hour) ?? 0,
    }))
  } catch (e) {
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode
    if (status === 404) return []
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] aggregateMarketplaceHourOfDay failed:", msg)
    return []
  }
}

export type MarketplaceOccurredAtBounds = {
  minIso: string
  maxIso: string
}

/** Min / max `occurred_at` for marketplace searches (documents missing surface count as marketplace). */
export async function getMarketplaceOccurredAtBounds(): Promise<MarketplaceOccurredAtBounds | null> {
  const es = getElasticsearchClient()
  if (!es) return null

  try {
    const res = await es.search({
      index: ELASTICSEARCH_SEARCH_ANALYTICS_INDEX,
      size: 0,
      track_total_hits: false,
      query: MARKETPLACE_SURFACE_FILTER as unknown as Record<string, unknown>,
      aggs: {
        min_t: { min: { field: "occurred_at" } },
        max_t: { max: { field: "occurred_at" } },
      },
    })
    const aggs = res.aggregations as
      | {
          min_t?: { value?: number | null; value_as_string?: string | null }
          max_t?: { value?: number | null; value_as_string?: string | null }
        }
      | undefined
    const minRaw = aggs?.min_t?.value_as_string ?? aggs?.min_t?.value
    const maxRaw = aggs?.max_t?.value_as_string ?? aggs?.max_t?.value

    let minIso: string | undefined
    let maxIso: string | undefined

    if (typeof minRaw === "string") minIso = minRaw
    else if (typeof minRaw === "number" && Number.isFinite(minRaw)) {
      minIso = new Date(minRaw).toISOString()
    }
    if (typeof maxRaw === "string") maxIso = maxRaw
    else if (typeof maxRaw === "number" && Number.isFinite(maxRaw)) {
      maxIso = new Date(maxRaw).toISOString()
    }

    if (!minIso || !maxIso) return null
    return { minIso, maxIso }
  } catch (e) {
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode
    if (status === 404) return null
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] getMarketplaceOccurredAtBounds failed:", msg)
    return null
  }
}

export async function topQueriesInRange(
  fromIso: string,
  toIso: string,
  size: number,
  opts?: { endInclusive?: boolean },
): Promise<Map<string, number>> {
  const es = getElasticsearchClient()
  if (!es) return new Map()

  const occurredRange =
    opts?.endInclusive === false
      ? { gte: fromIso, lt: toIso }
      : { gte: fromIso, lte: toIso }

  try {
    const res = await es.search({
      index: ELASTICSEARCH_SEARCH_ANALYTICS_INDEX,
      size: 0,
      query: {
        bool: {
          filter: [{ range: { occurred_at: occurredRange } }, MARKETPLACE_SURFACE_FILTER],
        },
      },
      aggs: {
        q: {
          terms: { field: "query_normalized", size, order: { _count: "desc" } },
        },
      },
    })
    const aggs = res.aggregations as { q?: { buckets?: Array<{ key: string | number; doc_count: number }> } }
    const m = new Map<string, number>()
    for (const b of aggs?.q?.buckets ?? []) {
      m.set(String(b.key), b.doc_count)
    }
    return m
  } catch (e) {
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode
    if (status === 404) return new Map()
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] topQueriesInRange failed:", msg)
    return new Map()
  }
}

export type NavBarMarketplaceKeywordAgg = {
  volumeByDay: { date: string; count: number }[]
  topQueries: { query: string; count: number }[]
  totalSubmits: number
}

/** Marketplace keyword `/search` loads attributed to header nav (`origin_surface: header_nav`). */
export async function aggregateNavBarMarketplaceKeywordAnalytics(
  fromIso: string,
  toIso: string,
): Promise<NavBarMarketplaceKeywordAgg | null> {
  const es = getElasticsearchClient()
  if (!es) return null

  try {
    const dateHistogram = {
      date_histogram: {
        field: "occurred_at",
        calendar_interval: "day" as const,
        min_doc_count: 0,
        extended_bounds: { min: fromIso, max: toIso },
      },
    }

    const res = await es.search({
      index: ELASTICSEARCH_SEARCH_ANALYTICS_INDEX,
      size: 0,
      track_total_hits: true,
      query: {
        bool: {
          filter: [
            { range: { occurred_at: { gte: fromIso, lte: toIso } } },
            MARKETPLACE_SURFACE_FILTER as unknown as Record<string, unknown>,
            { term: { origin_surface: "header_nav" } },
          ],
        },
      },
      aggs: {
        by_day: dateHistogram,
        top_queries: {
          terms: { field: "query_normalized", size: 40, order: { _count: "desc" } },
        },
      },
    })

    const aggs = res.aggregations as
      | {
          by_day?: { buckets?: Array<{ key_as_string?: string; doc_count: number }> }
          top_queries?: { buckets?: Array<{ key: string | number; doc_count: number }> }
        }
      | undefined

    const hitsTotal = res.hits?.total
    const total =
      typeof hitsTotal === "number"
        ? hitsTotal
        : typeof hitsTotal === "object" && hitsTotal && "value" in hitsTotal
          ? hitsTotal.value
          : 0

    return {
      volumeByDay: (aggs?.by_day?.buckets ?? []).map((b) => ({
        date: (b.key_as_string ?? "").slice(0, 10),
        count: b.doc_count,
      })),
      topQueries: bucketTerms(aggs?.top_queries?.buckets),
      totalSubmits: total,
    }
  } catch (e) {
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode
    if (status === 404) {
      return {
        volumeByDay: [],
        topQueries: [],
        totalSubmits: 0,
      }
    }
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] aggregateNavBarMarketplaceKeywordAnalytics failed:", msg)
    return null
  }
}

export type NavBarMarketplaceKeywordEventHit = {
  id: string
  occurredAt: string
  queryDisplay: string
  resultCount: number
}

/** Recent header-nav keyword `/search` loads (`origin_surface: header_nav`), newest first. */
export async function listNavBarMarketplaceKeywordEvents(
  fromIso: string,
  toIso: string,
  limit: number,
): Promise<NavBarMarketplaceKeywordEventHit[]> {
  const es = getElasticsearchClient()
  if (!es || limit < 1) return []

  try {
    const res = await es.search({
      index: ELASTICSEARCH_SEARCH_ANALYTICS_INDEX,
      size: limit,
      sort: [{ occurred_at: { order: "desc" } }],
      _source: ["occurred_at", "query_display", "result_count"],
      query: {
        bool: {
          filter: [
            { range: { occurred_at: { gte: fromIso, lte: toIso } } },
            MARKETPLACE_SURFACE_FILTER as unknown as Record<string, unknown>,
            { term: { origin_surface: "header_nav" } },
          ],
        },
      },
    })

    const out: NavBarMarketplaceKeywordEventHit[] = []
    for (const hit of res.hits.hits ?? []) {
      const src = hit._source as
        | {
            occurred_at?: string
            query_display?: string
            result_count?: number
          }
        | undefined
      const occurredAt = typeof src?.occurred_at === "string" ? src.occurred_at : ""
      const queryDisplay =
        typeof src?.query_display === "string" && src.query_display.trim()
          ? src.query_display.trim()
          : ""
      if (!occurredAt || !queryDisplay) continue
      const resultCount =
        typeof src?.result_count === "number" && Number.isFinite(src.result_count)
          ? src.result_count
          : 0
      out.push({
        id: typeof hit._id === "string" ? hit._id : `${occurredAt}:${queryDisplay}`,
        occurredAt,
        queryDisplay,
        resultCount,
      })
    }
    return out
  } catch (e) {
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode
    if (status === 404) return []
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] listNavBarMarketplaceKeywordEvents failed:", msg)
    return []
  }
}
