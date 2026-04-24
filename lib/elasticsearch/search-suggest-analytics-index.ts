import { getElasticsearchClient } from "./client"
import { ELASTICSEARCH_SEARCH_SUGGEST_ANALYTICS_INDEX } from "./config"

const INDEX_MAPPINGS = {
  properties: {
    occurred_at: { type: "date" as const },
    surface: { type: "keyword" as const },
    pick_kind: { type: "keyword" as const },
    suggest_trace: { type: "keyword" as const },
    query_prefix: { type: "keyword" as const, ignore_above: 512 },
    selection_label: { type: "keyword" as const, ignore_above: 512 },
    listing_id: { type: "keyword" as const },
  },
}

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
  query_prefix: string
  selection_label: string
  listing_id: string | null
}

export async function ensureSearchSuggestAnalyticsIndex(): Promise<boolean> {
  const es = getElasticsearchClient()
  if (!es) return false

  try {
    const exists = await es.indices.exists({ index: ELASTICSEARCH_SEARCH_SUGGEST_ANALYTICS_INDEX })
    if (!exists) {
      await es.indices.create({
        index: ELASTICSEARCH_SEARCH_SUGGEST_ANALYTICS_INDEX,
        mappings: INDEX_MAPPINGS,
      })
    }
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
      refresh: true,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] indexSearchSuggestPickDocument failed:", msg)
  }
}

export type SearchSuggestPickAggregateResult = {
  totalPicks: number
  byKind: { kind: string; count: number }[]
  byTrace: { trace: string; count: number }[]
}

export async function aggregateSearchSuggestPicks(
  fromIso: string,
  toIso: string,
): Promise<SearchSuggestPickAggregateResult | null> {
  const es = getElasticsearchClient()
  if (!es) return null

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
        by_kind: {
          terms: { field: "pick_kind", size: 24, order: { _count: "desc" } },
        },
        by_trace: {
          terms: { field: "suggest_trace", size: 8, order: { _count: "desc" } },
        },
      },
    })

    const total =
      typeof res.hits.total === "number" ? res.hits.total : (res.hits.total?.value ?? 0)
    const aggs = res.aggregations as {
      by_kind?: { buckets?: Array<{ key: string | number; doc_count: number }> }
      by_trace?: { buckets?: Array<{ key: string | number; doc_count: number }> }
    }

    return {
      totalPicks: total,
      byKind: (aggs.by_kind?.buckets ?? []).map((b) => ({
        kind: String(b.key),
        count: b.doc_count,
      })),
      byTrace: (aggs.by_trace?.buckets ?? []).map((b) => ({
        trace: String(b.key),
        count: b.doc_count,
      })),
    }
  } catch (e) {
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode
    if (status === 404) {
      return { totalPicks: 0, byKind: [], byTrace: [] }
    }
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] aggregateSearchSuggestPicks failed:", msg)
    return null
  }
}
