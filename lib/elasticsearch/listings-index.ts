import type { SupabaseClient } from "@supabase/supabase-js"
import { isElasticsearchIndexedListingSection } from "@/lib/elasticsearch/listing-sections"
import { isListingExternallyIndexable } from "@/lib/listing-public-visibility"
import { isMarketplaceSearchNoiseToken } from "@/lib/utils/marketplace-brand-query"
import { parseFinsSetupFromStorage } from "@/lib/listing-fin-setup-tags"
import {
  parseTailShapeFromStorage,
  TAIL_SHAPE_LABELS,
  type TailShapeTagSlug,
} from "@/lib/listing-tail-shape-tags"
import { parseBoardMeasurement } from "@/lib/board-measurements"
import { parseListingDimensionsColumn } from "@/lib/listing-dimensions-storage"
import { resolveLengthTotalInches, resolveVolumeLiters } from "@/lib/listing-facet-write"
import {
  CONSTRUCTION_OPTIONS,
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS,
} from "@/lib/boards-browse-facets"
import { LISTING_CONDITION_LABELS } from "@/lib/listing-labels"
import { getElasticsearchClient } from "./client"
import { ELASTICSEARCH_LISTINGS_INDEX } from "./config"

export type ListingSearchDoc = {
  id: string
  title: string
  description: string
  section: string
  status: string
  category_name: string
  board_type: string | null
  category_id: string | null
  brand: string | null
  /** Surfboard model label (catalog or free text). */
  model: string | null
  city: string | null
  state: string | null
  created_at: string
  /* ---- /boards browse faceting + geo (indexed for filter/sort/aggregations) ---- */
  condition: string | null
  fin_system: string | null
  construction: string | null
  /** Canonical fin-setup slugs (comma list in DB → array here for `terms` membership). */
  fins_setup: string[]
  /** Canonical tail-shape slugs (comma list in DB → array here for `terms` membership). */
  tail_shape: string[]
  length_total_inches: number | null
  volume_liters: number | null
  /** Parsed board width in inches (`listings.width`, with `dimensions` fallback). */
  width_inches: number | null
  /** Parsed board thickness in inches (`listings.thickness`, with `dimensions` fallback). */
  thickness_inches: number | null
  price: number | null
  brand_id: string | null
  brand_model_id: string | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  suppressed_on_boards_browse: boolean | null
  /** Lowercased `listings.dimensions` for wildcard token filters. */
  dimensions: string | null
  /**
   * Human-readable facet/attr bag for free-text search (condition, fins, construction,
   * tail, dimensions, shipping). Slug fields stay keyword for exact filters.
   */
  attrs_text: string
  /** Geo point for `geo_distance` filter + nearest sort; omitted when lat/lng missing. */
  location?: { lat: number; lon: number }
  /** Magazine publication year (`listings.magazine_year`). */
  magazine_year: number | null
  /** Wetsuit size slug (`listings.wetsuit_size`). */
  wetsuit_size: string | null
  /** Wetsuit thickness slug (`listings.wetsuit_thickness`). */
  wetsuit_thickness: string | null
  /** Wetsuit zip type slug (`listings.wetsuit_zip_type`). */
  wetsuit_zip_type: string | null
}

const INDEX_SETTINGS = {
  analysis: {
    analyzer: {
      listing_text: {
        type: "custom" as const,
        tokenizer: "standard",
        filter: ["lowercase", "asciifolding"],
      },
    },
  },
}

/** Original relevance fields — created with the index; never re-sent via `putMapping`. */
const BASE_INDEX_PROPERTIES = {
  id: { type: "keyword" as const },
  title: {
    type: "text" as const,
    analyzer: "listing_text",
    fields: { keyword: { type: "keyword" as const } },
  },
  description: { type: "text" as const, analyzer: "listing_text" },
  section: { type: "keyword" as const },
  status: { type: "keyword" as const },
  category_name: { type: "text" as const, analyzer: "listing_text" },
  board_type: { type: "keyword" as const },
  brand: { type: "text" as const, analyzer: "listing_text" },
  model: { type: "text" as const, analyzer: "listing_text" },
  city: { type: "text" as const },
  state: { type: "text" as const },
  created_at: { type: "date" as const },
}

/**
 * `/boards` browse facet + geo fields. These are new (absent from pre-existing docs), so an
 * additive `putMapping` on an existing index is safe — unlike the base fields, whose analyzers
 * can't be changed once created.
 */
const BROWSE_INDEX_PROPERTIES = {
  category_id: { type: "keyword" as const },
  condition: { type: "keyword" as const },
  fin_system: { type: "keyword" as const },
  construction: { type: "keyword" as const },
  fins_setup: { type: "keyword" as const },
  tail_shape: { type: "keyword" as const },
  length_total_inches: { type: "float" as const },
  volume_liters: { type: "float" as const },
  width_inches: { type: "float" as const },
  thickness_inches: { type: "float" as const },
  price: { type: "double" as const },
  brand_id: { type: "keyword" as const },
  brand_model_id: { type: "keyword" as const },
  local_pickup: { type: "boolean" as const },
  shipping_available: { type: "boolean" as const },
  suppressed_on_boards_browse: { type: "boolean" as const },
  dimensions: { type: "keyword" as const },
  attrs_text: { type: "text" as const, analyzer: "listing_text" },
  location: { type: "geo_point" as const },
}

/** Section-specific facet fields (magazines, wetsuits). Additive on existing indices. */
const SECTION_INDEX_PROPERTIES = {
  magazine_year: { type: "integer" as const },
  wetsuit_size: { type: "keyword" as const },
  wetsuit_thickness: { type: "keyword" as const },
  wetsuit_zip_type: { type: "keyword" as const },
}

const ADDITIVE_INDEX_PROPERTIES = {
  ...BROWSE_INDEX_PROPERTIES,
  ...SECTION_INDEX_PROPERTIES,
}

const INDEX_MAPPINGS = {
  properties: { ...BASE_INDEX_PROPERTIES, ...ADDITIVE_INDEX_PROPERTIES },
}

/**
 * Memoized per warm instance: the index is created (or its mapping brought forward
 * additively via `putMapping`) at most once. Additive field mappings are backward
 * compatible — existing docs pick up the new fields after a reindex.
 */
let listingsIndexReady = false

export async function ensureListingsIndex(): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return
  if (listingsIndexReady) return

  try {
    const exists = await es.indices.exists({ index: ELASTICSEARCH_LISTINGS_INDEX })
    if (!exists) {
      await es.indices.create({
        index: ELASTICSEARCH_LISTINGS_INDEX,
        settings: INDEX_SETTINGS,
        mappings: INDEX_MAPPINGS,
      })
    } else {
      // Additive mapping update: only the new browse fields (base-field analyzers can't change).
      await es.indices.putMapping({
        index: ELASTICSEARCH_LISTINGS_INDEX,
        properties: ADDITIVE_INDEX_PROPERTIES,
      })
    }
    listingsIndexReady = true
  } catch (e) {
    // Cluster unreachable, bad credentials, TLS, etc. — don’t crash callers; search falls back to DB.
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] ensureListingsIndex failed:", msg, e)
  }
}

export async function indexListingDocument(
  doc: ListingSearchDoc,
  options?: { refresh?: boolean | "wait_for" },
): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  await ensureListingsIndex()
  await es.index({
    index: ELASTICSEARCH_LISTINGS_INDEX,
    id: doc.id,
    document: doc,
    refresh: options?.refresh ?? false,
  })
}

export async function deleteListingDocument(listingId: string): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  try {
    await es.delete({
      index: ELASTICSEARCH_LISTINGS_INDEX,
      id: listingId,
      refresh: false,
    })
  } catch (e: unknown) {
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode
    if (status === 404) return
    throw e
  }
}

/** @deprecated Legacy search UI; ES listing search defaults to surfboards-only marketplace scope. */
export type SearchSectionFilter = "all" | "boards"

const SEARCH_FIELDS = [
  "title^3",
  "description^2",
  "category_name^2",
  "brand^2",
  "model^2",
  "attrs_text^2",
  "board_type",
  "condition",
  "construction",
  "fin_system",
  "fins_setup",
  "tail_shape",
  "dimensions",
  "city",
  "state",
] as const

const FIN_SYSTEM_LABELS = Object.fromEntries(FIN_SYSTEM_OPTIONS.map((o) => [o.value, o.label]))
const FIN_SETUP_LABELS = Object.fromEntries(FIN_SETUP_OPTIONS.map((o) => [o.value, o.label]))
const CONSTRUCTION_LABELS = Object.fromEntries(CONSTRUCTION_OPTIONS.map((o) => [o.value, o.label]))

/** Build searchable text covering surfboard attrs used in NL / keyword matching. */
export function buildListingAttrsText(input: {
  category_name?: string | null
  board_type?: string | null
  condition?: string | null
  fin_system?: string | null
  construction?: string | null
  fins_setup?: string[]
  tail_shape?: string[]
  dimensions?: string | null
  length_total_inches?: number | null
  width_inches?: number | null
  thickness_inches?: number | null
  volume_liters?: number | null
  shipping_available?: boolean | null
  local_pickup?: boolean | null
  price?: number | null
}): string {
  const parts: string[] = []
  const push = (v: string | null | undefined) => {
    const t = v?.trim()
    if (t) parts.push(t)
  }

  push(input.category_name)
  push(input.board_type?.replace(/-/g, " "))
  if (input.condition) {
    push(LISTING_CONDITION_LABELS[input.condition] ?? input.condition.replace(/_/g, " "))
    push(input.condition.replace(/_/g, " "))
  }
  if (input.fin_system) {
    push(FIN_SYSTEM_LABELS[input.fin_system] ?? input.fin_system.replace(/_/g, " "))
    push(input.fin_system.replace(/_/g, " "))
  }
  if (input.construction) {
    push(CONSTRUCTION_LABELS[input.construction] ?? input.construction.replace(/_/g, " "))
    push(input.construction.replace(/_/g, " "))
    // Casual synonyms sellers/searchers use.
    if (input.construction === "eps_epoxy") push("epoxy")
    if (input.construction === "pu_poly") push("poly polyurethane")
    if (input.construction === "carbon") push("carbon fiber")
  }
  for (const slug of input.fins_setup ?? []) {
    push(FIN_SETUP_LABELS[slug] ?? slug.replace(/_/g, " "))
    push(slug.replace(/_/g, " "))
  }
  for (const slug of input.tail_shape ?? []) {
    const label = TAIL_SHAPE_LABELS[slug as TailShapeTagSlug] ?? slug
    push(label)
    push(`${label} tail`)
    push(slug)
  }
  push(input.dimensions)
  if (input.length_total_inches != null && Number.isFinite(input.length_total_inches)) {
    const inches = Math.round(input.length_total_inches)
    const ft = Math.floor(inches / 12)
    const inch = inches % 12
    push(`${ft}'${inch}`)
    push(`${inches} inches`)
  }
  if (input.width_inches != null && Number.isFinite(input.width_inches)) {
    push(`${input.width_inches} width`)
  }
  if (input.thickness_inches != null && Number.isFinite(input.thickness_inches)) {
    push(`${input.thickness_inches} thickness`)
  }
  if (input.volume_liters != null && Number.isFinite(input.volume_liters)) {
    push(`${input.volume_liters}L`)
    push(`${input.volume_liters} liters`)
  }
  if (input.price != null && Number.isFinite(input.price)) {
    push(`$${Math.round(input.price)}`)
  }
  if (input.shipping_available) {
    push("shipping ships shippable")
  }
  if (input.local_pickup) {
    push("local pickup meetup")
  }

  return parts.join(" ").replace(/\s+/g, " ").trim()
}

/**
 * English function words excluded from Elasticsearch `minimum_should_match` logic.
 * Without this, a partial brand like "channel is" (typing "Channel Islands") requires
 * a separate match on "is", which filters out almost all Channel Islands listings.
 */
const ELASTICSEARCH_SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "but",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "so",
  "that",
  "the",
  "this",
  "to",
  "was",
  "were",
  "with",
])

function isElasticsearchSearchStopWord(token: string): boolean {
  return ELASTICSEARCH_SEARCH_STOP_WORDS.has(token.trim().toLowerCase())
}

/**
 * Tokens that carry real search intent. Pure digits (e.g. from "6/4/3" thickness) are
 * excluded so a single "6" cannot match unrelated listings like "Monsta 6".
 */
export function meaningfulSearchTerms(raw: string): string[] {
  const s = raw.trim().toLowerCase()
  if (!s) return []
  const tokens = s.match(/[\w']+/g) ?? []
  const out: string[] = []
  const seen = new Set<string>()
  for (const t of tokens) {
    const core = t.replace(/^['']+|['']+$/g, "")
    if (core.length < 2) continue
    if (/^\d+$/.test(core)) continue
    if (isMarketplaceSearchNoiseToken(core)) continue
    if (isElasticsearchSearchStopWord(core)) continue
    if (seen.has(core)) continue
    seen.add(core)
    out.push(core)
  }
  return out
}

/** How many distinct meaningful terms must match (spread across indexed fields). */
function requiredMeaningfulMatches(meaningfulCount: number): number {
  if (meaningfulCount <= 1) return 1
  return Math.min(meaningfulCount, Math.max(2, Math.ceil(meaningfulCount * 0.65)))
}

/** Normalized, de-duped admin synonym expansions to widen recall (e.g. "ci" -> "channel islands"). */
function normalizeExpansions(expansions: string[] | undefined): string[] {
  if (!expansions?.length) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const e of expansions) {
    const v = e.trim()
    const key = v.toLowerCase()
    if (!v || seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

/**
 * Soft ranking clauses for leftover NL keywords when structured filters already
 * own recall (brand / price / fins…). Never used as `must`.
 */
export function buildListingsRankBoostShouldClauses(rawQuery: string): object[] {
  const q = rawQuery.trim()
  if (!q) return []
  const meaningful = meaningfulSearchTerms(q)
  const clauses: object[] = [
    {
      multi_match: {
        query: q,
        fields: ["title^4", "brand^3", "model^3", "category_name^2"],
        type: "phrase",
        boost: 6,
      },
    },
    {
      multi_match: {
        query: q,
        fields: ["title^2", "model^2", "description"],
        type: "best_fields",
        operator: "or",
        tie_breaker: 0.2,
        boost: 2,
      },
    },
  ]
  for (const term of meaningful) {
    clauses.push({
      multi_match: {
        query: term,
        fields: ["title^2", "model^2", "brand", "description"],
        type: "best_fields",
        boost: 1.25,
      },
    })
  }
  return clauses
}

/**
 * Builds a bool query: requires a majority of meaningful terms (not lone digits),
 * plus optional phrase boosts so exact titles rank higher. Admin `expansions`
 * (synonyms) are added as additional satisfying clauses so aliases/typos recover results.
 *
 * Shared by `/search` and `/boards` browse keyword search.
 */
export function buildListingsSearchQueryBody(
  filter: object[],
  rawQuery: string,
  expansions?: string[],
): object {
  const q = rawQuery.trim()
  const meaningful = meaningfulSearchTerms(q)
  const expansionTerms = normalizeExpansions(expansions)
  const expansionClauses = expansionTerms.map((term) => ({
    multi_match: {
      query: term,
      fields: [...SEARCH_FIELDS],
      type: "best_fields" as const,
      operator: "or" as const,
    },
  }))
  const expansionPhraseBoosts = expansionTerms.map((term) => ({
    multi_match: {
      query: term,
      fields: ["title^3", "brand^3", "model^3", "category_name^2"],
      type: "phrase" as const,
      boost: 3,
    },
  }))

  if (meaningful.length === 0) {
    // Only digits / symbols / very short tokens — keep lenient but still use analyzed match
    return {
      bool: {
        filter,
        must: [
          {
            bool: {
              should: [
                {
                  multi_match: {
                    query: q,
                    fields: [...SEARCH_FIELDS],
                    type: "best_fields",
                    tie_breaker: 0.2,
                    operator: "or",
                    fuzziness: "AUTO",
                  },
                },
                ...expansionClauses,
              ],
              minimum_should_match: 1,
            },
          },
        ],
      },
    }
  }

  const required = requiredMeaningfulMatches(meaningful.length)
  const termClauses = meaningful.map((term) => ({
    multi_match: {
      query: term,
      fields: [...SEARCH_FIELDS],
      type: "best_fields",
      operator: "or",
    },
  }))

  return {
    bool: {
      filter,
      must: [
        {
          bool: {
            // Expansion clauses can satisfy the requirement on their own (alias/typo recovery).
            should: [...termClauses, ...expansionClauses],
            minimum_should_match: required,
          },
        },
      ],
      should: [
        {
          multi_match: {
            query: q,
            fields: ["title^4", "brand^3", "model^3", "category_name^2"],
            type: "phrase",
            boost: 5,
          },
        },
        {
          multi_match: {
            query: q,
            fields: ["title^2", "description"],
            type: "phrase",
            slop: 2,
            boost: 2,
          },
        },
        {
          multi_match: {
            query: q,
            fields: [...SEARCH_FIELDS],
            type: "best_fields",
            tie_breaker: 0.15,
            operator: "or",
            boost: 0.35,
          },
        },
        ...expansionPhraseBoosts,
      ],
      minimum_should_match: 0,
    },
  }
}

/** Lenient match on the strongest token when the strict query returns nothing (typos in title/brand). */
export function buildListingsTypoFallbackQueryBody(
  filter: object[],
  rawQuery: string,
): object | null {
  const meaningful = meaningfulSearchTerms(rawQuery)
  if (meaningful.length === 0) return null
  const term = [...meaningful].sort((a, b) => b.length - a.length)[0]
  if (!term || term.length < 4) return null

  return {
    bool: {
      filter,
      should: [
        {
          multi_match: {
            query: term,
            fields: [...SEARCH_FIELDS],
            type: "best_fields",
            tie_breaker: 0.2,
            operator: "or",
            fuzziness: "AUTO",
          },
        },
      ],
      minimum_should_match: 1,
    },
  }
}

/**
 * Returns listing IDs in relevance order (then created_at).
 */
/**
 * Keyword search over listings. Defaults to **surfboards** section only (matches marketplace search default).
 * Pass `sections` to override (e.g. for legacy callers).
 */
export async function searchListingIdsFromElasticsearch(
  rawQuery: string,
  limit: number,
  options?: {
    sections?: string[]
    categoryName?: string | null
    typoFallback?: boolean
    /** Admin synonym expansions OR-added to widen recall (ignored on typo fallback). */
    expansions?: string[]
    /** Directory brand filter (`listings.brand_id`). */
    brandId?: string | null
    /** Catalog model filter (`listings.brand_model_id`). */
    brandModelId?: string | null
    /** Multiple catalog model ids (e.g. Dumpster Diver + Dumpster Diver 2). */
    brandModelIds?: string[] | null
    /** Exact board length in inches (±1" range). */
    lengthInches?: number | null
  },
): Promise<string[]> {
  const es = getElasticsearchClient()
  if (!es) return []

  try {
    await ensureListingsIndex()

    const sections = options?.sections ?? ["surfboards"]

    const filter: object[] = [
      { term: { status: "active" } },
      { terms: { section: sections } },
    ]

    const cat = typeof options?.categoryName === "string" ? options.categoryName.trim() : ""
    if (cat) {
      filter.push({ match_phrase: { category_name: cat } })
    }

    const brandModelIds = (options?.brandModelIds ?? [])
      .map((id) => id.trim())
      .filter(Boolean)
    const brandModelId = options?.brandModelId?.trim()
    if (brandModelIds.length > 0) {
      filter.push({ terms: { brand_model_id: brandModelIds } })
    } else if (brandModelId) {
      filter.push({ term: { brand_model_id: brandModelId } })
    } else {
      const brandId = options?.brandId?.trim()
      if (brandId) filter.push({ term: { brand_id: brandId } })
    }

    const lengthInches = options?.lengthInches
    if (lengthInches != null && Number.isFinite(lengthInches) && lengthInches > 0) {
      filter.push({
        range: {
          length_total_inches: {
            gte: lengthInches - 1,
            lte: lengthInches + 1,
          },
        },
      })
    }

    const q = rawQuery.trim()
    const queryBody = options?.typoFallback
      ? buildListingsTypoFallbackQueryBody(filter, q)
      : buildListingsSearchQueryBody(filter, q, options?.expansions)

    if (q && options?.typoFallback && !queryBody) {
      return []
    }

    const res = q && queryBody
      ? await es.search({
          index: ELASTICSEARCH_LISTINGS_INDEX,
          size: limit,
          _source: false,
          query: queryBody,
          sort: [{ _score: { order: "desc" } }, { created_at: { order: "desc" } }],
        })
      : await es.search({
          index: ELASTICSEARCH_LISTINGS_INDEX,
          size: limit,
          _source: false,
          query: { bool: { filter } },
          sort: [{ created_at: { order: "desc" } }],
        })

    return (res.hits.hits ?? [])
      .map((h) => h._id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] searchListingIdsFromElasticsearch failed:", msg, e)
    throw e
  }
}

/** Columns required to build a full browse-ready listing search doc. */
/**
 * Columns for ES listing docs. Board dims live on `dimensions` +
 * `length_total_inches` / `volume_liters` — legacy `length_feet` / `width` /
 * `thickness` / `volume` were dropped (see 20260816120000).
 */
export const LISTING_SEARCH_DOC_SELECT = `
  id,
  title,
  description,
  section,
  status,
  board_type,
  category_id,
  brand,
  model,
  city,
  state,
  created_at,
  condition,
  fin_system,
  construction,
  fins_setup,
  tail_shape,
  length_total_inches,
  volume_liters,
  price,
  brand_id,
  brand_model_id,
  local_pickup,
  shipping_available,
  suppressed_on_boards_browse,
  dimensions,
  latitude,
  longitude,
  magazine_year,
  wetsuit_size,
  hidden_from_site,
  archived_at,
  categories (name)
`

export type ListingSearchDocRow = {
  id: string
  title: string | null
  description: string | null
  section: string
  status: string
  board_type: string | null
  category_id: string | null
  brand: string | null
  model: string | null
  city: string | null
  state: string | null
  created_at: string
  condition?: string | null
  fin_system?: string | null
  construction?: string | null
  fins_setup?: string | null
  tail_shape?: string | null
  length_total_inches?: number | null
  volume_liters?: number | null
  price?: number | string | null
  brand_id?: string | null
  brand_model_id?: string | null
  local_pickup?: boolean | null
  shipping_available?: boolean | null
  suppressed_on_boards_browse?: boolean | null
  dimensions?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  magazine_year?: number | null
  wetsuit_size?: string | null
  hidden_from_site?: boolean | null
  archived_at?: string | null
  categories: { name: string | null } | null | { name: string | null }[]
}

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function dimensionInchesFromParsedColumn(
  raw: string | null | undefined,
  pick: (parsed: NonNullable<ReturnType<typeof parseListingDimensionsColumn>>) => string,
): number | null {
  const parsed = raw?.trim() ? parseListingDimensionsColumn(raw) : null
  if (!parsed) return null
  const token = pick(parsed).trim()
  if (!token) return null
  return parseBoardMeasurement(token) ?? toFiniteNumber(token)
}

function resolveWidthInches(row: ListingSearchDocRow): number | null {
  return dimensionInchesFromParsedColumn(row.dimensions, (p) => p.boardWidthInches)
}

function resolveThicknessInches(row: ListingSearchDocRow): number | null {
  return dimensionInchesFromParsedColumn(row.dimensions, (p) => p.boardThicknessInches)
}

function browseMeasurementRow(row: ListingSearchDocRow) {
  return {
    length_total_inches: row.length_total_inches,
    volume_liters: row.volume_liters,
    dimensions: row.dimensions,
    title: row.title,
  }
}

/** Load listing + category name from Supabase and build ES document. */
/** Build ES document from a listing row (e.g. reindex batch — no extra DB round-trip). */
export function listingRowToSearchDocFromRow(row: ListingSearchDocRow): ListingSearchDoc {
  const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories
  const lat = toFiniteNumber(row.latitude)
  const lon = toFiniteNumber(row.longitude)
  const fins_setup = parseFinsSetupFromStorage(row.fins_setup)
  const tail_shape = parseTailShapeFromStorage(row.tail_shape)
  const length_total_inches = resolveLengthTotalInches(browseMeasurementRow(row))
  const volume_liters = resolveVolumeLiters(browseMeasurementRow(row))
  const width_inches = resolveWidthInches(row)
  const thickness_inches = resolveThicknessInches(row)
  const dimensions = row.dimensions?.trim() ? row.dimensions.trim().toLowerCase() : null
  const price = toFiniteNumber(row.price)
  const shipping_available = row.shipping_available ?? null
  const local_pickup = row.local_pickup ?? null
  const category_name = cat?.name ?? ""
  const condition = row.condition ?? null
  const fin_system = row.fin_system ?? null
  const construction = row.construction ?? null

  return {
    id: row.id,
    title: row.title ?? "",
    description: row.description ?? "",
    section: row.section,
    status: row.status,
    category_name,
    board_type: row.board_type,
    category_id: row.category_id ?? null,
    brand: row.brand,
    model: row.model,
    city: row.city,
    state: row.state,
    created_at: row.created_at,
    condition,
    fin_system,
    construction,
    fins_setup,
    tail_shape,
    length_total_inches,
    volume_liters,
    width_inches,
    thickness_inches,
    price,
    brand_id: row.brand_id ?? null,
    brand_model_id: row.brand_model_id ?? null,
    local_pickup,
    shipping_available,
    suppressed_on_boards_browse: row.suppressed_on_boards_browse ?? null,
    dimensions,
    attrs_text: buildListingAttrsText({
      category_name,
      board_type: row.board_type,
      condition,
      fin_system,
      construction,
      fins_setup,
      tail_shape,
      dimensions,
      length_total_inches,
      width_inches,
      thickness_inches,
      volume_liters,
      shipping_available,
      local_pickup,
      price,
    }),
    magazine_year: toFiniteNumber(row.magazine_year),
    wetsuit_size: row.wetsuit_size?.trim() || null,
    // Thickness / zip were dropped from `listings`; keep ES fields null for mapping compat.
    wetsuit_thickness: null,
    wetsuit_zip_type: null,
    ...(lat != null && lon != null ? { location: { lat, lon } } : {}),
  }
}

export async function listingRowToSearchDoc(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingSearchDoc | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SEARCH_DOC_SELECT)
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return null

  return listingRowToSearchDocFromRow(data as unknown as ListingSearchDocRow)
}

export async function syncListingToIndex(
  supabase: SupabaseClient,
  listingId: string,
  options?: { refresh?: boolean | "wait_for" },
): Promise<void> {
  if (!getElasticsearchClient()) return

  const { data: visibilityRow, error: visibilityError } = await supabase
    .from("listings")
    .select("id, status, title, hidden_from_site, archived_at")
    .eq("id", listingId)
    .maybeSingle()

  if (visibilityError) return
  if (!visibilityRow) {
    await deleteListingDocument(listingId)
    return
  }

  const row = visibilityRow as {
    status?: string | null
    title?: string | null
    hidden_from_site?: boolean | null
    archived_at?: string | null
  }

  if (
    !isListingExternallyIndexable({
      status: String(row.status ?? ""),
      title: row.title,
      hidden_from_site: row.hidden_from_site,
      archived_at: row.archived_at,
    })
  ) {
    await deleteListingDocument(listingId)
    return
  }

  const doc = await listingRowToSearchDoc(supabase, listingId)
  if (!doc) return

  if (!isElasticsearchIndexedListingSection(doc.section)) {
    await deleteListingDocument(listingId)
    return
  }

  await indexListingDocument(doc, options)
}
