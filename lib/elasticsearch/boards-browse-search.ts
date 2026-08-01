/**
 * Elasticsearch query layer for the `/boards` browse page: indexed filtering,
 * `geo_distance` radius/nearest sorting, and faceted availability counts via
 * aggregations — replacing the in-memory haversine sort and the lean-row facet scan.
 *
 * This module is pure ES (ids / totals / counts). Row hydration + top-picks
 * orchestration live in `lib/db/boards-browse-listings-es.ts`.
 */

import type { estypes } from "@elastic/elasticsearch"
import { getElasticsearchClient } from "./client"
import { ELASTICSEARCH_LISTINGS_INDEX } from "./config"
import {
  buildListingsRankBoostShouldClauses,
  buildListingsSearchQueryBody,
  buildListingsTypoFallbackQueryBody,
  ensureListingsIndex,
} from "./listings-index"
import {
  BOARD_STYLE_OPTIONS,
  CONDITION_OPTIONS,
  CONSTRUCTION_OPTIONS,
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS,
  LENGTH_BUCKETS,
  VOLUME_BUCKETS,
  type BoardsBrowseFacetSelections,
  type RangeBucket,
} from "@/lib/boards-browse-facets"
import {
  boardTypeForDbFromBrowseParam,
  browseTypeParamFromBoardType,
} from "@/lib/marketplace-slug-metadata"
import { categoryIdsForBrowseBoardTypes } from "@/lib/utils/board-type-from-category-id"
import type { BoardsBrowseFacetCounts } from "@/lib/services/boardsBrowseFacetCounts"
import { isUuidString } from "@/lib/utils/isUuid"
import {
  TAIL_SHAPE_LABELS,
  type TailShapeTagSlug,
} from "@/lib/listing-tail-shape-tags"

/** Attach `must_not` to a listings bool query body (keyword builders already set filter/must/should). */
function withMustNot(queryBody: object, mustNot: object[]): object {
  if (mustNot.length === 0) return queryBody
  const body = queryBody as { bool?: Record<string, unknown> }
  if (!body.bool) return queryBody
  const existing = body.bool.must_not
  const prior = Array.isArray(existing) ? existing : existing != null ? [existing] : []
  return {
    bool: {
      ...body.bool,
      must_not: [...prior, ...mustNot],
    },
  }
}

function withRankBoosts(queryBody: object, rankQuery: string | undefined): object {
  const rank = rankQuery?.trim()
  if (!rank) return queryBody
  const boosts = buildListingsRankBoostShouldClauses(rank)
  if (boosts.length === 0) return queryBody
  const body = queryBody as { bool?: Record<string, unknown> }
  if (!body.bool) return queryBody
  const existing = body.bool.should
  const prior = Array.isArray(existing) ? existing : existing != null ? [existing] : []
  return {
    bool: {
      ...body.bool,
      should: [...prior, ...boosts],
      // Keep prior MSM when present; soft boosts must not become required.
      minimum_should_match: body.bool.minimum_should_match ?? 0,
    },
  }
}

function boardsBrowseKeywordQuery(
  filter: object[],
  query: string | undefined,
  mustNot: object[],
  typoFallback = false,
  expansions?: string[],
  rankQuery?: string,
): object | null {
  const q = query?.trim()
  if (!q) {
    return withRankBoosts(
      {
        bool: {
          filter: filter as estypes.QueryDslQueryContainer[],
          must_not: mustNot as estypes.QueryDslQueryContainer[],
        },
      },
      rankQuery,
    )
  }
  const body = typoFallback
    ? buildListingsTypoFallbackQueryBody(filter, q)
    : buildListingsSearchQueryBody(filter, q, expansions)
  if (!body) return null
  return withRankBoosts(withMustNot(body, mustNot), rankQuery)
}

/** ES filter for board style slugs — matches `board_type` or surfboard `category_id`. */
function boardStyleFilterClause(styleSlugs: string[]): object | null {
  const dbTypes = styleDbTypes(styleSlugs)
  const categoryIds = categoryIdsForBrowseBoardTypes(styleSlugs)
  const should: object[] = []
  if (dbTypes.length > 0) should.push({ terms: { board_type: dbTypes } })
  if (categoryIds.length > 0) should.push({ terms: { category_id: categoryIds } })
  if (should.length === 0) return null
  if (should.length === 1) return should[0]!
  return { bool: { should, minimum_should_match: 1 } }
}

/** Distinct, canonical `board_type` DB values for the selected style facet slugs. */
function styleDbTypes(styles: string[]): string[] {
  return Array.from(
    new Set(
      styles
        .map((s) => boardTypeForDbFromBrowseParam(s))
        .filter((v): v is string => Boolean(v)),
    ),
  )
}

function rangeBucketClause(field: string, bucket: RangeBucket): object {
  const range: Record<string, number> = {}
  if (bucket.min != null) range.gte = bucket.min
  if (bucket.max != null) range.lt = bucket.max
  return { range: { [field]: range } }
}

function numericBucketsClause(
  field: string,
  slugs: string[],
  buckets: readonly RangeBucket[],
): object | null {
  const selected = buckets.filter((b) => slugs.includes(b.value))
  if (selected.length === 0) return null
  return {
    bool: {
      should: selected.map((b) => rangeBucketClause(field, b)),
      minimum_should_match: 1,
    },
  }
}

/** Per-facet ES filter clause from the user's selection (null when nothing selected). */
type FacetKey = keyof BoardsBrowseFacetCounts

function facetSelectionClauses(
  sel: BoardsBrowseFacetSelections,
): Record<FacetKey, object | null> {
  return {
    style: boardStyleFilterClause(sel.styles),
    condition: sel.conditions.length > 0 ? { terms: { condition: sel.conditions } } : null,
    fin: sel.finSetups.length > 0 ? { terms: { fins_setup: sel.finSetups } } : null,
    finSystem: sel.finSystems.length > 0 ? { terms: { fin_system: sel.finSystems } } : null,
    construction:
      sel.constructions.length > 0 ? { terms: { construction: sel.constructions } } : null,
    length: numericBucketsClause("length_total_inches", sel.lengthBuckets, LENGTH_BUCKETS),
    volume: numericBucketsClause("volume_liters", sel.volumeBuckets, VOLUME_BUCKETS),
  }
}

/* -------------------------------------------------------------------------- */
/* Base context (keyword / brand / model / price / location text)             */
/* -------------------------------------------------------------------------- */

export type BoardsBrowseEsContext = {
  query?: string
  /**
   * Soft ranking text from NL residual keywords. Never required for a hit —
   * used when brand/price/fin (etc.) filters already constrain the result set.
   */
  rankQuery?: string
  brand?: string
  model?: string
  brandId?: string
  brandModelId?: string
  /** Multiple catalog model ids (Dumpster Diver + variants). */
  brandModelIds?: string[]
  minPrice?: number
  maxPrice?: number
  /** Free-text city/state filter (only when there is no geocoded anchor). */
  locationText?: string
  /** When true, only listings where the seller offers shipping. */
  shippingAvailable?: boolean
  /** Admin synonym expansions for keyword recall (e.g. "ci" → "channel islands"). */
  expansions?: string[]
  /** Exact board length from query parse (`5'10` → 70); applied as a tight inches range. */
  lengthInches?: number
  /** Inclusive min board length in inches (`over 7 feet`). */
  minLengthInches?: number
  /** Exclusive max board length in inches (`under 6 feet` → 72). */
  maxLengthInches?: number
  /**
   * Tail-shape slugs from NL/rules. Matches indexed `tail_shape` OR title/model/attrs_text
   * (many listings omit the structured tail field).
   */
  tailShapes?: string[]
}

function priceClauses(ctx: BoardsBrowseEsContext): object[] {
  const out: object[] = []
  if (ctx.minPrice != null && !Number.isNaN(ctx.minPrice) && ctx.minPrice >= 0) {
    out.push({ range: { price: { gte: ctx.minPrice } } })
  }
  if (ctx.maxPrice != null && !Number.isNaN(ctx.maxPrice) && ctx.maxPrice >= 0) {
    out.push({ range: { price: { lte: ctx.maxPrice } } })
  }
  return out
}

function brandModelClauses(ctx: BoardsBrowseEsContext): object[] {
  const brandModelIds = (ctx.brandModelIds ?? [])
    .map((id) => id.trim())
    .filter((id) => isUuidString(id))
  const brandModelId = ctx.brandModelId?.trim()
  const brandId = ctx.brandId?.trim()
  if (brandModelIds.length > 0) {
    return [{ terms: { brand_model_id: brandModelIds } }]
  }
  if (brandModelId && isUuidString(brandModelId)) {
    return [{ term: { brand_model_id: brandModelId } }]
  }
  if (brandId && isUuidString(brandId)) {
    return [{ term: { brand_id: brandId } }]
  }
  const out: object[] = []
  const brand = ctx.brand?.trim()
  if (brand) out.push({ match: { brand } })
  const model = ctx.model?.trim()
  if (model) {
    out.push({
      bool: {
        should: [{ match: { model } }, { match: { title: model } }],
        minimum_should_match: 1,
      },
    })
  }
  return out
}

function locationTextClauses(locationText: string | undefined): object[] {
  const loc = locationText?.trim()
  if (!loc) return []
  return [
    {
      multi_match: {
        query: loc,
        fields: ["city", "state"],
        type: "best_fields",
        operator: "or",
      },
    },
  ]
}

function lengthInchesClause(lengthInches: number | undefined): object | null {
  if (lengthInches == null || !Number.isFinite(lengthInches) || lengthInches <= 0) {
    return null
  }
  // ±1" tolerance around the parsed length (covers 5'10 vs 5'10.5 rounding).
  return {
    range: {
      length_total_inches: {
        gte: lengthInches - 1,
        lte: lengthInches + 1,
      },
    },
  }
}

function lengthBoundsClause(
  minLengthInches: number | undefined,
  maxLengthInches: number | undefined,
): object | null {
  const range: Record<string, number> = {}
  if (minLengthInches != null && Number.isFinite(minLengthInches) && minLengthInches > 0) {
    range.gte = minLengthInches
  }
  if (maxLengthInches != null && Number.isFinite(maxLengthInches) && maxLengthInches > 0) {
    range.lt = maxLengthInches
  }
  if (Object.keys(range).length === 0) return null
  return { range: { length_total_inches: range } }
}

/** Filters shared by browse results and facet counts (excludes facet selections + geo). */
function baseContextFilters(ctx: BoardsBrowseEsContext): object[] {
  const filters: object[] = [
    { term: { status: "active" } },
    { term: { section: "surfboards" } },
    ...priceClauses(ctx),
    ...brandModelClauses(ctx),
    ...locationTextClauses(ctx.locationText),
  ]
  if (ctx.shippingAvailable) {
    filters.push({ term: { shipping_available: true } })
  }
  // Exact length wins over open bounds when both are present.
  const exactLength = lengthInchesClause(ctx.lengthInches)
  if (exactLength) {
    filters.push(exactLength)
  } else {
    const bounds = lengthBoundsClause(ctx.minLengthInches, ctx.maxLengthInches)
    if (bounds) filters.push(bounds)
  }
  const tailClause = tailShapeFilterClause(ctx.tailShapes)
  if (tailClause) filters.push(tailClause)
  return filters
}

/** Prefer structured `tail_shape`, but also match title/model/attrs when sellers skipped the field. */
function tailShapeFilterClause(tailShapes: string[] | undefined): object | null {
  const slugs = (tailShapes ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean)
  if (slugs.length === 0) return null

  const should: object[] = [{ terms: { tail_shape: slugs } }]
  for (const slug of slugs) {
    const label = TAIL_SHAPE_LABELS[slug as TailShapeTagSlug] ?? slug
    should.push({
      multi_match: {
        query: `${label} tail ${slug}`,
        fields: ["title^2", "model^2", "attrs_text^2", "description"],
        type: "best_fields",
        operator: "or",
      },
    })
  }
  return { bool: { should, minimum_should_match: 1 } }
}

/* -------------------------------------------------------------------------- */
/* Listings search (results page)                                             */
/* -------------------------------------------------------------------------- */

export type BoardsBrowseEsSearchParams = BoardsBrowseEsContext & {
  /** Nav `type=` param mapped to a single `board_type` (facet styles take precedence). */
  boardType?: string
  /** Single-select condition from nav (multi-select lives in `facets.conditions`). */
  condition?: string
  facets?: BoardsBrowseFacetSelections
  dimensionTokens?: string[]
  geo?: { lat: number; lng: number; radiusMi?: number }
  /** `newest` | `price-low` | `price-high` | `price-newest` | `nearest`. */
  sort: string
  useSuppressionSort?: boolean
  restrictToIds?: string[]
  excludeIds?: string[]
  from: number
  size: number
}

function buildListingsFilters(params: BoardsBrowseEsSearchParams): object[] {
  const filters = baseContextFilters(params)
  const facets = params.facets

  const styleSlugs =
    (facets?.styles?.length ?? 0) > 0
      ? (facets?.styles ?? [])
      : params.boardType && params.boardType !== "all"
        ? [params.boardType]
        : []
  const styleClause = boardStyleFilterClause(styleSlugs)
  if (styleClause) filters.push(styleClause)

  if (facets?.conditions?.length) {
    filters.push({ terms: { condition: facets.conditions } })
  } else if (params.condition && params.condition !== "all") {
    filters.push({ term: { condition: params.condition } })
  }

  if (facets?.finSystems?.length) filters.push({ terms: { fin_system: facets.finSystems } })
  if (facets?.constructions?.length) filters.push({ terms: { construction: facets.constructions } })
  if (facets?.finSetups?.length) filters.push({ terms: { fins_setup: facets.finSetups } })

  const lengthClause = numericBucketsClause(
    "length_total_inches",
    facets?.lengthBuckets ?? [],
    LENGTH_BUCKETS,
  )
  if (lengthClause) filters.push(lengthClause)

  const volumeClause = numericBucketsClause(
    "volume_liters",
    facets?.volumeBuckets ?? [],
    VOLUME_BUCKETS,
  )
  if (volumeClause) filters.push(volumeClause)

  for (const token of params.dimensionTokens ?? []) {
    const t = token.trim().toLowerCase()
    if (t) filters.push({ wildcard: { dimensions: `*${t}*` } })
  }

  if (params.geo?.radiusMi && params.geo.radiusMi > 0) {
    filters.push({
      geo_distance: {
        distance: `${params.geo.radiusMi}mi`,
        location: { lat: params.geo.lat, lon: params.geo.lng },
      },
    })
  }

  const restrict = params.restrictToIds?.filter(Boolean) ?? []
  if (restrict.length > 0) filters.push({ ids: { values: restrict } })

  return filters
}

function buildSort(params: BoardsBrowseEsSearchParams): object[] {
  const sort: object[] = []
  if (params.useSuppressionSort) {
    sort.push({ suppressed_on_boards_browse: { order: "asc", missing: "_first" } })
  }

  const geo = params.geo
  if (params.sort === "nearest" && geo) {
    sort.push({
      _geo_distance: {
        location: { lat: geo.lat, lon: geo.lng },
        order: "asc",
        unit: "mi",
      },
    })
    return sort
  }

  const hasKeyword = Boolean(params.query?.trim() || params.rankQuery?.trim())

  if (params.sort === "price-low") {
    sort.push({ price: { order: "asc", missing: "_last" } })
  } else if (params.sort === "price-high") {
    sort.push({ price: { order: "desc", missing: "_last" } })
  } else if (params.sort === "price-newest") {
    sort.push({ price: { order: "desc", missing: "_last" } })
    sort.push({ created_at: { order: "desc" } })
  } else {
    // Newest / default — prefer relevance when keyword searching (same as `/search`).
    if (hasKeyword) sort.push({ _score: { order: "desc" } })
    sort.push({ created_at: { order: "desc" } })
  }
  return sort
}

export type BoardsBrowseEsResult = { ids: string[]; total: number }

function parseBoardsBrowseHits(res: estypes.SearchResponse): BoardsBrowseEsResult {
  const ids = (res.hits.hits ?? [])
    .map((h) => h._id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)

  const totalRaw = res.hits.total
  const total = typeof totalRaw === "number" ? totalRaw : (totalRaw?.value ?? 0)

  return { ids, total }
}

/** Filtered / geo browse over Elasticsearch. Returns ordered listing ids + total match count. */
export async function searchBoardsBrowse(
  params: BoardsBrowseEsSearchParams,
): Promise<BoardsBrowseEsResult | null> {
  const es = getElasticsearchClient()
  if (!es) return null

  await ensureListingsIndex()

  const filter = buildListingsFilters(params)
  const mustNot: object[] = []
  const exclude = params.excludeIds?.filter(Boolean) ?? []
  if (exclude.length > 0) mustNot.push({ ids: { values: exclude } })

  const from = Math.max(0, params.from)
  const size = Math.max(0, params.size)
  // ES rejects from + size > 10000 by default; clamp deep pagination.
  if (from + size > 10_000) return { ids: [], total: 0 }

  const keywordQuery = boardsBrowseKeywordQuery(
    filter,
    params.query,
    mustNot,
    false,
    params.expansions,
    params.rankQuery,
  )
  if (!keywordQuery) return { ids: [], total: 0 }

  const sort = buildSort(params) as estypes.Sort

  const res = await es.search({
    index: ELASTICSEARCH_LISTINGS_INDEX,
    from,
    size,
    _source: false,
    track_total_hits: true,
    query: keywordQuery as estypes.QueryDslQueryContainer,
    sort,
  })

  const parsed = parseBoardsBrowseHits(res)
  const q = params.query?.trim()
  if (!q || parsed.total > 0 || parsed.ids.length > 0) return parsed

  // Same typo recovery as `/search` when the strict listings query returns nothing.
  const typoQuery = boardsBrowseKeywordQuery(
    filter,
    q,
    mustNot,
    true,
    params.expansions,
    params.rankQuery,
  )
  if (!typoQuery) return parsed

  const typoRes = await es.search({
    index: ELASTICSEARCH_LISTINGS_INDEX,
    from,
    size,
    _source: false,
    track_total_hits: true,
    query: typoQuery as estypes.QueryDslQueryContainer,
    sort,
  })

  return parseBoardsBrowseHits(typoRes)
}

/* -------------------------------------------------------------------------- */
/* Faceted availability counts (aggregations)                                 */
/* -------------------------------------------------------------------------- */

const TERMS_AGG_SIZE = 50

function facetValuesAgg(key: FacetKey): estypes.AggregationsAggregationContainer {
  switch (key) {
    case "style":
      return { terms: { field: "board_type", size: TERMS_AGG_SIZE } }
    case "condition":
      return { terms: { field: "condition", size: TERMS_AGG_SIZE } }
    case "fin":
      return { terms: { field: "fins_setup", size: TERMS_AGG_SIZE } }
    case "finSystem":
      return { terms: { field: "fin_system", size: TERMS_AGG_SIZE } }
    case "construction":
      return { terms: { field: "construction", size: TERMS_AGG_SIZE } }
    case "length":
      return {
        range: {
          field: "length_total_inches",
          keyed: true,
          ranges: LENGTH_BUCKETS.map(rangeAggRange),
        },
      }
    case "volume":
      return {
        range: {
          field: "volume_liters",
          keyed: true,
          ranges: VOLUME_BUCKETS.map(rangeAggRange),
        },
      }
  }
}

function rangeAggRange(b: RangeBucket): { key: string; from?: number; to?: number } {
  const r: { key: string; from?: number; to?: number } = { key: b.value }
  if (b.min != null) r.from = b.min
  if (b.max != null) r.to = b.max
  return r
}

const FACET_KEYS: FacetKey[] = [
  "style",
  "condition",
  "fin",
  "finSystem",
  "construction",
  "length",
  "volume",
]

type TermsBucket = { key: string | number; doc_count: number }
type AggNode = {
  values?: {
    buckets?: TermsBucket[] | Record<string, { doc_count: number }>
  }
}

function termsBucketsToMap(
  buckets: TermsBucket[] | undefined,
  allowed: readonly string[],
): Record<string, number> {
  const allowedSet = new Set(allowed)
  const out: Record<string, number> = {}
  for (const value of allowed) out[value] = 0
  for (const b of buckets ?? []) {
    const key = String(b.key)
    if (allowedSet.has(key)) out[key] = b.doc_count
  }
  return out
}

function keyedRangeToMap(
  keyed: Record<string, { doc_count: number }> | undefined,
  buckets: readonly RangeBucket[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const b of buckets) out[b.value] = keyed?.[b.value]?.doc_count ?? 0
  return out
}

/** Style buckets are `board_type` DB values; fold them into canonical style slugs. */
function styleBucketsToMap(buckets: TermsBucket[] | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const o of BOARD_STYLE_OPTIONS) out[o.value] = 0
  for (const b of buckets ?? []) {
    const slug = browseTypeParamFromBoardType(String(b.key))
    if (slug && slug in out) out[slug] += b.doc_count
  }
  return out
}

/**
 * Cross-faceted availability counts computed in one aggregation request. For each facet,
 * counts reflect all *other* selected facets (standard faceted-search behavior).
 */
export async function boardsBrowseFacetCountsFromEs(
  ctx: BoardsBrowseEsContext,
  sel: BoardsBrowseFacetSelections,
): Promise<BoardsBrowseFacetCounts | null> {
  const es = getElasticsearchClient()
  if (!es) return null

  await ensureListingsIndex()

  const selectionClauses = facetSelectionClauses(sel)
  const aggs: Record<string, estypes.AggregationsAggregationContainer> = {}
  for (const key of FACET_KEYS) {
    const otherClauses = FACET_KEYS.filter((k) => k !== key)
      .map((k) => selectionClauses[k])
      .filter((c): c is object => c != null)
    aggs[key] = {
      filter: { bool: { filter: otherClauses as estypes.QueryDslQueryContainer[] } },
      aggs: { values: facetValuesAgg(key) },
    }
  }

  const filter = baseContextFilters(ctx)
  const facetQuery = boardsBrowseKeywordQuery(
    filter,
    ctx.query,
    [],
    false,
    ctx.expansions,
    ctx.rankQuery,
  ) ?? {
    bool: { filter: filter as estypes.QueryDslQueryContainer[] },
  }

  const res = await es.search({
    index: ELASTICSEARCH_LISTINGS_INDEX,
    size: 0,
    query: facetQuery as estypes.QueryDslQueryContainer,
    aggs,
  })

  const resAggs = (res.aggregations ?? {}) as Record<string, AggNode>
  const styleBuckets = resAggs.style?.values?.buckets as TermsBucket[] | undefined

  return {
    style: styleBucketsToMap(styleBuckets),
    condition: termsBucketsToMap(
      resAggs.condition?.values?.buckets as TermsBucket[] | undefined,
      CONDITION_OPTIONS.map((o) => o.value),
    ),
    fin: termsBucketsToMap(
      resAggs.fin?.values?.buckets as TermsBucket[] | undefined,
      FIN_SETUP_OPTIONS.map((o) => o.value),
    ),
    finSystem: termsBucketsToMap(
      resAggs.finSystem?.values?.buckets as TermsBucket[] | undefined,
      FIN_SYSTEM_OPTIONS.map((o) => o.value),
    ),
    construction: termsBucketsToMap(
      resAggs.construction?.values?.buckets as TermsBucket[] | undefined,
      CONSTRUCTION_OPTIONS.map((o) => o.value),
    ),
    length: keyedRangeToMap(
      resAggs.length?.values?.buckets as Record<string, { doc_count: number }> | undefined,
      LENGTH_BUCKETS,
    ),
    volume: keyedRangeToMap(
      resAggs.volume?.values?.buckets as Record<string, { doc_count: number }> | undefined,
      VOLUME_BUCKETS,
    ),
  }
}
