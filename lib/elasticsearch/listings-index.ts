import type { SupabaseClient } from "@supabase/supabase-js"
import { isMarketplaceSearchNoiseToken } from "@/lib/utils/marketplace-brand-query"
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
  brand: string | null
  /** Surfboard model label (catalog or free text). */
  model: string | null
  city: string | null
  state: string | null
  created_at: string
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

const INDEX_MAPPINGS = {
  properties: {
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
  },
}

export async function ensureListingsIndex(): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  try {
    const exists = await es.indices.exists({ index: ELASTICSEARCH_LISTINGS_INDEX })
    if (!exists) {
      await es.indices.create({
        index: ELASTICSEARCH_LISTINGS_INDEX,
        settings: INDEX_SETTINGS,
        mappings: INDEX_MAPPINGS,
      })
    }
  } catch (e) {
    // Cluster unreachable, bad credentials, TLS, etc. — don’t crash callers; search falls back to DB.
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] ensureListingsIndex failed:", msg, e)
  }
}

export async function indexListingDocument(doc: ListingSearchDoc): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  await ensureListingsIndex()
  await es.index({
    index: ELASTICSEARCH_LISTINGS_INDEX,
    id: doc.id,
    document: doc,
    refresh: false,
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
  "board_type",
  "city",
  "state",
] as const

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
 * Builds a bool query: requires a majority of meaningful terms (not lone digits),
 * plus optional phrase boosts so exact titles rank higher. Admin `expansions`
 * (synonyms) are added as additional satisfying clauses so aliases/typos recover results.
 */
function buildListingsSearchQueryBody(
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
function buildListingsTypoFallbackQueryBody(filter: object[], rawQuery: string): object | null {
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

/** Load listing + category name from Supabase and build ES document. */
/** Build ES document from a listing row (e.g. reindex batch — no extra DB round-trip). */
export function listingRowToSearchDocFromRow(row: {
  id: string
  title: string | null
  description: string | null
  section: string
  status: string
  board_type: string | null
  brand: string | null
  model: string | null
  city: string | null
  state: string | null
  created_at: string
  categories: { name: string | null } | null | { name: string | null }[]
}): ListingSearchDoc {
  const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories
  return {
    id: row.id,
    title: row.title ?? "",
    description: row.description ?? "",
    section: row.section,
    status: row.status,
    category_name: cat?.name ?? "",
    board_type: row.board_type,
    brand: row.brand,
    model: row.model,
    city: row.city,
    state: row.state,
    created_at: row.created_at,
  }
}

export async function listingRowToSearchDoc(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingSearchDoc | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(
      `
      id,
      title,
      description,
      section,
      status,
      board_type,
      brand,
      model,
      city,
      state,
      created_at,
      categories (name)
    `,
    )
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return null

  return listingRowToSearchDocFromRow(
    data as unknown as Parameters<typeof listingRowToSearchDocFromRow>[0],
  )
}

export async function syncListingToIndex(
  supabase: SupabaseClient,
  listingId: string,
): Promise<void> {
  if (!getElasticsearchClient()) return

  const { data: visibilityRow, error: visibilityError } = await supabase
    .from("listings")
    .select("id, hidden_from_site")
    .eq("id", listingId)
    .maybeSingle()

  if (visibilityError) return
  if (!visibilityRow) {
    await deleteListingDocument(listingId)
    return
  }
  if ((visibilityRow as { hidden_from_site?: boolean | null }).hidden_from_site) {
    await deleteListingDocument(listingId)
    return
  }

  const doc = await listingRowToSearchDoc(supabase, listingId)
  if (!doc) return

  if (doc.status !== "active" || doc.section !== "surfboards") {
    await deleteListingDocument(listingId)
    return
  }

  await indexListingDocument(doc)
}
