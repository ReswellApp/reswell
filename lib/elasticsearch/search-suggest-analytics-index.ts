import { getElasticsearchClient } from "./client"
import { ELASTICSEARCH_SEARCH_SUGGEST_ANALYTICS_INDEX } from "./config"

const INDEX_MAPPINGS = {
  properties: {
    occurred_at: { type: "date" as const },
    surface: { type: "keyword" as const },
    pick_kind: { type: "keyword" as const },
    suggest_trace: { type: "keyword" as const },
    /** `pick` (default) = click/selection; `hover` = dwell hover in the dropdown. */
    interaction: { type: "keyword" as const },
    query_prefix: { type: "keyword" as const, ignore_above: 512 },
    selection_label: { type: "keyword" as const, ignore_above: 512 },
    listing_id: { type: "keyword" as const },
  },
}

/** Legacy docs omit `interaction`; those events are treated as clicks in aggregations. */
export type SearchSuggestInteraction = "pick" | "hover"

export type SearchSuggestPickSurface = "header_nav" | "sell_brand_title" | "other"

export type SearchSuggestPickKind =
  | "top_listing"
  | "brand_strip"
  | "brand_row"
  | "category_chip"
  | "suggestion_title"
  | "suggestion_brand"
  | "suggestion_category"
  | "view_all_results"
  | "brand_catalog"

export type SearchSuggestPickTrace =
  | "marketplace_elasticsearch"
  | "marketplace_supabase"
  | "brand_catalog_elasticsearch"
  | "brand_catalog_supabase"

export type SearchSuggestPickDoc = {
  occurred_at: string
  surface: SearchSuggestPickSurface
  pick_kind: SearchSuggestPickKind
  suggest_trace: SearchSuggestPickTrace
  interaction: SearchSuggestInteraction
  query_prefix: string
  selection_label: string
  listing_id: string | null
}

let searchSuggestAnalyticsIndexReady = false

export async function ensureSearchSuggestAnalyticsIndex(): Promise<boolean> {
  const es = getElasticsearchClient()
  if (!es) return false
  if (searchSuggestAnalyticsIndexReady) return true

  try {
    const exists = await es.indices.exists({ index: ELASTICSEARCH_SEARCH_SUGGEST_ANALYTICS_INDEX })
    if (!exists) {
      await es.indices.create({
        index: ELASTICSEARCH_SEARCH_SUGGEST_ANALYTICS_INDEX,
        mappings: INDEX_MAPPINGS,
      })
    } else {
      try {
        await es.indices.putMapping({
          index: ELASTICSEARCH_SEARCH_SUGGEST_ANALYTICS_INDEX,
          properties: { interaction: { type: "keyword" } },
        })
      } catch {
        // Index may already include the field or mapping update unsupported — safe to ignore.
      }
    }
    searchSuggestAnalyticsIndexReady = true
    return true
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] ensureSearchSuggestAnalyticsIndex failed:", msg)
    return false
  }
}

export async function indexSearchSuggestPickDocument(doc: SearchSuggestPickDoc): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  const ready = await ensureSearchSuggestAnalyticsIndex()
  if (!ready) return

  try {
    await es.index({
      index: ELASTICSEARCH_SEARCH_SUGGEST_ANALYTICS_INDEX,
      document: doc,
      refresh: false,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] indexSearchSuggestPickDocument failed:", msg)
  }
}

export type SearchSuggestListingClickRow = {
  listingId: string
  title: string
  count: number
}

export type SearchSuggestPickAggregateResult = {
  /** Click / selection events (excludes hover-only). */
  totalClicks: number
  totalHovers: number
  byKind: { kind: string; count: number }[]
  byTrace: { trace: string; count: number }[]
  topQueryPrefixesClicks: { prefix: string; count: number }[]
  topQueryPrefixesHovers: { prefix: string; count: number }[]
  topListingClicks: SearchSuggestListingClickRow[]
  hoverByKind: { kind: string; count: number }[]
}

const CLICK_INTERACTION_FILTER = {
  bool: {
    should: [
      { term: { interaction: "pick" } },
      { bool: { must_not: { exists: { field: "interaction" } } } },
    ],
    minimum_should_match: 1,
  },
}

function parseTopHitsLabel(hit: unknown): string {
  const h = hit as { _source?: { selection_label?: string } } | undefined
  const raw = h?._source?.selection_label
  return typeof raw === "string" && raw.trim() ? raw.trim() : "—"
}

export async function aggregateSearchSuggestPicks(
  fromIso: string,
  toIso: string,
): Promise<SearchSuggestPickAggregateResult | null> {
  const es = getElasticsearchClient()
  if (!es) return null

  const empty: SearchSuggestPickAggregateResult = {
    totalClicks: 0,
    totalHovers: 0,
    byKind: [],
    byTrace: [],
    topQueryPrefixesClicks: [],
    topQueryPrefixesHovers: [],
    topListingClicks: [],
    hoverByKind: [],
  }

  try {
    const res = await es.search({
      index: ELASTICSEARCH_SEARCH_SUGGEST_ANALYTICS_INDEX,
      size: 0,
      track_total_hits: true,
      query: {
        bool: {
          filter: [{ range: { occurred_at: { gte: fromIso, lte: toIso } } }],
        },
      },
      aggs: {
        clicks: {
          filter: CLICK_INTERACTION_FILTER,
          aggs: {
            by_kind: {
              terms: { field: "pick_kind", size: 24, order: { _count: "desc" } },
            },
            by_trace: {
              terms: { field: "suggest_trace", size: 8, order: { _count: "desc" } },
            },
            top_prefixes: {
              terms: { field: "query_prefix", size: 30, order: { _count: "desc" } },
            },
            listing_rows: {
              filter: {
                bool: {
                  must: [
                    { term: { pick_kind: "top_listing" } },
                    { exists: { field: "listing_id" } },
                  ],
                },
              },
              aggs: {
                by_listing: {
                  terms: { field: "listing_id", size: 20, order: { _count: "desc" } },
                  aggs: {
                    sample: {
                      top_hits: {
                        size: 1,
                        sort: [{ occurred_at: { order: "desc" } }],
                        _source: { includes: ["selection_label"] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        hovers: {
          filter: { term: { interaction: "hover" } },
          aggs: {
            by_kind: {
              terms: { field: "pick_kind", size: 24, order: { _count: "desc" } },
            },
            top_prefixes: {
              terms: { field: "query_prefix", size: 30, order: { _count: "desc" } },
            },
          },
        },
      },
    })

    const aggs = res.aggregations as {
      clicks?: {
        doc_count: number
        by_kind?: { buckets?: Array<{ key: string | number; doc_count: number }> }
        by_trace?: { buckets?: Array<{ key: string | number; doc_count: number }> }
        top_prefixes?: { buckets?: Array<{ key: string | number; doc_count: number }> }
        listing_rows?: {
          by_listing?: {
            buckets?: Array<{
              key: string | number
              doc_count: number
              sample?: { hits?: { hits?: unknown[] } }
            }>
          }
        }
      }
      hovers?: {
        doc_count: number
        by_kind?: { buckets?: Array<{ key: string | number; doc_count: number }> }
        top_prefixes?: { buckets?: Array<{ key: string | number; doc_count: number }> }
      }
    }

    const clicks = aggs.clicks
    const hovers = aggs.hovers

    const topListingClicks: SearchSuggestListingClickRow[] = []
    for (const b of clicks?.listing_rows?.by_listing?.buckets ?? []) {
      const listingId = String(b.key)
      if (!listingId || listingId === "null") continue
      const labelHit = b.sample?.hits?.hits?.[0]
      topListingClicks.push({
        listingId,
        title: parseTopHitsLabel(labelHit),
        count: b.doc_count,
      })
    }

    return {
      totalClicks: clicks?.doc_count ?? 0,
      totalHovers: hovers?.doc_count ?? 0,
      byKind: (clicks?.by_kind?.buckets ?? []).map((b) => ({
        kind: String(b.key),
        count: b.doc_count,
      })),
      byTrace: (clicks?.by_trace?.buckets ?? []).map((b) => ({
        trace: String(b.key),
        count: b.doc_count,
      })),
      topQueryPrefixesClicks: (clicks?.top_prefixes?.buckets ?? []).map((b) => ({
        prefix: String(b.key),
        count: b.doc_count,
      })),
      topQueryPrefixesHovers: (hovers?.top_prefixes?.buckets ?? []).map((b) => ({
        prefix: String(b.key),
        count: b.doc_count,
      })),
      topListingClicks,
      hoverByKind: (hovers?.by_kind?.buckets ?? []).map((b) => ({
        kind: String(b.key),
        count: b.doc_count,
      })),
    }
  } catch (e) {
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode
    if (status === 404) {
      return empty
    }
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] aggregateSearchSuggestPicks failed:", msg)
    return null
  }
}

export type HeaderNavSuggestClickAgg = {
  volumeByDay: { date: string; count: number }[]
  totalClicks: number
}

/** Dropdown clicks (`interaction: pick` / legacy missing) on `surface: header_nav` only. */
export async function aggregateHeaderNavSuggestClickAnalytics(
  fromIso: string,
  toIso: string,
): Promise<HeaderNavSuggestClickAgg | null> {
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
      index: ELASTICSEARCH_SEARCH_SUGGEST_ANALYTICS_INDEX,
      size: 0,
      track_total_hits: true,
      query: {
        bool: {
          filter: [
            { range: { occurred_at: { gte: fromIso, lte: toIso } } },
            { term: { surface: "header_nav" } },
            CLICK_INTERACTION_FILTER as unknown as Record<string, unknown>,
          ],
        },
      },
      aggs: {
        by_day: dateHistogram,
      },
    })

    const aggs = res.aggregations as
      | { by_day?: { buckets?: Array<{ key_as_string?: string; doc_count: number }> } }
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
      totalClicks: total,
    }
  } catch (e) {
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode
    if (status === 404) {
      return { volumeByDay: [], totalClicks: 0 }
    }
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] aggregateHeaderNavSuggestClickAnalytics failed:", msg)
    return null
  }
}

export type HeaderNavSuggestPickEventHit = {
  id: string
  occurredAt: string
  queryPrefix: string
  selectionLabel: string
  pickKind: string
}

/** Recent header-nav typeahead clicks (`surface: header_nav`), newest first. */
export async function listHeaderNavSuggestPickEvents(
  fromIso: string,
  toIso: string,
  limit: number,
): Promise<HeaderNavSuggestPickEventHit[]> {
  const es = getElasticsearchClient()
  if (!es || limit < 1) return []

  try {
    const res = await es.search({
      index: ELASTICSEARCH_SEARCH_SUGGEST_ANALYTICS_INDEX,
      size: limit,
      sort: [{ occurred_at: { order: "desc" } }],
      _source: ["occurred_at", "query_prefix", "selection_label", "pick_kind"],
      query: {
        bool: {
          filter: [
            { range: { occurred_at: { gte: fromIso, lte: toIso } } },
            { term: { surface: "header_nav" } },
            CLICK_INTERACTION_FILTER as unknown as Record<string, unknown>,
          ],
        },
      },
    })

    const out: HeaderNavSuggestPickEventHit[] = []
    for (const hit of res.hits.hits ?? []) {
      const src = hit._source as
        | {
            occurred_at?: string
            query_prefix?: string
            selection_label?: string
            pick_kind?: string
          }
        | undefined
      const occurredAt = typeof src?.occurred_at === "string" ? src.occurred_at : ""
      const queryPrefix =
        typeof src?.query_prefix === "string" && src.query_prefix.trim()
          ? src.query_prefix.trim()
          : ""
      if (!occurredAt || !queryPrefix) continue
      const selectionLabel = parseTopHitsLabel(hit)
      const pickKind =
        typeof src?.pick_kind === "string" && src.pick_kind.trim() ? src.pick_kind.trim() : "—"
      out.push({
        id: typeof hit._id === "string" ? hit._id : `${occurredAt}:${queryPrefix}`,
        occurredAt,
        queryPrefix,
        selectionLabel,
        pickKind,
      })
    }
    return out
  } catch (e) {
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode
    if (status === 404) return []
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] listHeaderNavSuggestPickEvents failed:", msg)
    return []
  }
}

export type SearchSuggestSelectionRow = {
  label: string
  kind: string
  count: number
}

/** Top typeahead dropdown selections (clicks) for the daily Gemini report. */
export async function aggregateSearchSuggestTopSelections(
  fromIso: string,
  toIsoExclusive: string,
  size = 40,
): Promise<SearchSuggestSelectionRow[]> {
  const es = getElasticsearchClient()
  if (!es || size < 1) return []

  try {
    const res = await es.search({
      index: ELASTICSEARCH_SEARCH_SUGGEST_ANALYTICS_INDEX,
      size: 0,
      query: {
        bool: {
          filter: [
            { range: { occurred_at: { gte: fromIso, lt: toIsoExclusive } } },
            CLICK_INTERACTION_FILTER as unknown as Record<string, unknown>,
          ],
        },
      },
      aggs: {
        by_label: {
          terms: { field: "selection_label", size, order: { _count: "desc" } },
          aggs: {
            sample: {
              top_hits: {
                size: 1,
                sort: [{ occurred_at: { order: "desc" } }],
                _source: { includes: ["pick_kind"] },
              },
            },
          },
        },
      },
    })

    const aggs = res.aggregations as
      | {
          by_label?: {
            buckets?: Array<{
              key: string | number
              doc_count: number
              sample?: { hits?: { hits?: Array<{ _source?: { pick_kind?: string } }> } }
            }>
          }
        }
      | undefined

    const out: SearchSuggestSelectionRow[] = []
    for (const b of aggs?.by_label?.buckets ?? []) {
      const label = String(b.key).trim()
      if (!label) continue
      const kindRaw = b.sample?.hits?.hits?.[0]?._source?.pick_kind
      const kind = typeof kindRaw === "string" && kindRaw.trim() ? kindRaw.trim() : "—"
      out.push({ label, kind, count: b.doc_count })
    }
    return out
  } catch (e) {
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode
    if (status === 404) return []
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] aggregateSearchSuggestTopSelections failed:", msg)
    return []
  }
}
