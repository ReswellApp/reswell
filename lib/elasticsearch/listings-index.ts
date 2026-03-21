import type { SupabaseClient } from "@supabase/supabase-js"
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
    city: { type: "text" as const },
    state: { type: "text" as const },
    created_at: { type: "date" as const },
  },
}

export async function ensureListingsIndex(): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  const exists = await es.indices.exists({ index: ELASTICSEARCH_LISTINGS_INDEX })
  if (!exists) {
    await es.indices.create({
      index: ELASTICSEARCH_LISTINGS_INDEX,
      settings: INDEX_SETTINGS,
      mappings: INDEX_MAPPINGS,
    })
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

export type SearchSectionFilter = "all" | "used" | "boards"

const SEARCH_FIELDS = [
  "title^3",
  "description^2",
  "category_name^2",
  "brand^2",
  "board_type",
  "city",
  "state",
] as const

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

/**
 * Builds a bool query: requires a majority of meaningful terms (not lone digits),
 * plus optional phrase boosts so exact titles rank higher.
 */
function buildListingsSearchQueryBody(filter: object[], rawQuery: string): object {
  const q = rawQuery.trim()
  const meaningful = meaningfulSearchTerms(q)

  if (meaningful.length === 0) {
    // Only digits / symbols / very short tokens — keep lenient but still use analyzed match
    return {
      bool: {
        filter,
        must: [
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
            should: termClauses,
            minimum_should_match: required,
          },
        },
      ],
      should: [
        {
          multi_match: {
            query: q,
            fields: ["title^4", "brand^3", "category_name^2"],
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
      ],
      minimum_should_match: 0,
    },
  }
}

/**
 * Returns listing IDs in relevance order (then created_at).
 */
export async function searchListingIdsFromElasticsearch(
  rawQuery: string,
  section: SearchSectionFilter,
  limit: number,
): Promise<string[]> {
  const es = getElasticsearchClient()
  if (!es) return []

  await ensureListingsIndex()

  const sections =
    section === "used"
      ? ["used"]
      : section === "boards"
        ? ["surfboards"]
        : ["used", "surfboards"]

  const filter: object[] = [
    { term: { status: "active" } },
    { terms: { section: sections } },
  ]

  const q = rawQuery.trim()

  const res = q
    ? await es.search({
        index: ELASTICSEARCH_LISTINGS_INDEX,
        size: limit,
        _source: false,
        query: buildListingsSearchQueryBody(filter, q),
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

  const doc = await listingRowToSearchDoc(supabase, listingId)
  if (!doc) return

  if (doc.status !== "active" || !["used", "surfboards"].includes(doc.section)) {
    await deleteListingDocument(listingId)
    return
  }

  await indexListingDocument(doc)
}
