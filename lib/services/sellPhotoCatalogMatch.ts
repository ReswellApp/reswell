import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getSellCatalogBrandRowsByIds,
  getSellCatalogModelRowsByIds,
} from "@/lib/db/sell-catalog-search"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import {
  searchSellCatalogByEmbedding,
  searchSellCatalogHitsFromElasticsearch,
  type SellCatalogEsHit,
} from "@/lib/elasticsearch/sell-catalog-index"
import {
  rankSellPhotoCatalogRows,
  selectVisualCatalogHits,
  sellPhotoCatalogQueries,
  sellPhotoMatchSearchCategories,
  type SellPhotoCatalogCandidate,
} from "@/lib/sell-flow/sell-photo-match"
import { searchSellCatalogForSell } from "@/lib/services/sellCatalogSearch"
import type { SellCatalogSearchMatchTier } from "@/lib/types/sell-catalog-search"
import type { SellPhotoObservation } from "@/lib/validations/sellPhotoMatch"

/** Earlier queries are the brand+model read off the board. Later ones are weaker fallbacks. */
const QUERY_WEIGHTS = [3, 1.8, 1.4, 1.1]

export type SellPhotoCatalogMatch = {
  rows: SellPhotoCatalogCandidate["row"][]
  matchTier: SellCatalogSearchMatchTier
  backend: "elasticsearch" | "supabase" | null
  lookupQuery: string | null
  /** True when Gemini Embedding 2 nearest-neighbor hits were part of the result. */
  usedEmbedding: boolean
}

async function vectorCandidates(
  supabase: SupabaseClient,
  observation: SellPhotoObservation,
  vector: readonly number[],
): Promise<SellPhotoCatalogCandidate[]> {
  const hits = await searchSellCatalogByEmbedding(vector, {
    limit: 12,
    categories: sellPhotoMatchSearchCategories(),
  })
  const hydrated = await hydrateHits(supabase, hits)
  return selectVisualCatalogHits(
    observation,
    hydrated.map((candidate) => ({ row: candidate.row, cosine: candidate.esScore })),
  )
}

async function hydrateHits(
  supabase: SupabaseClient,
  hits: readonly SellCatalogEsHit[],
): Promise<SellPhotoCatalogCandidate[]> {
  if (hits.length === 0) return []
  const categories = sellPhotoMatchSearchCategories()
  const modelIds = hits.filter((hit) => hit.kind === "model").map((hit) => hit.id)
  const brandIds = hits.filter((hit) => hit.kind === "brand").map((hit) => hit.id)
  const [models, brands] = await Promise.all([
    getSellCatalogModelRowsByIds(supabase, modelIds, categories),
    getSellCatalogBrandRowsByIds(supabase, brandIds, categories),
  ])

  const byKey = new Map<string, SellPhotoCatalogCandidate["row"]>()
  for (const row of [...models, ...brands]) {
    byKey.set(`${row.kind}-${row.id}`, row)
  }

  const candidates: SellPhotoCatalogCandidate[] = []
  for (const hit of hits) {
    const row = byKey.get(`${hit.kind}-${hit.id}`)
    if (!row) continue
    candidates.push({ row, esScore: hit.score })
  }
  return candidates
}

async function elasticsearchCandidates(
  supabase: SupabaseClient,
  queries: readonly string[],
): Promise<SellPhotoCatalogCandidate[]> {
  const categories = sellPhotoMatchSearchCategories()
  const lists = await Promise.all(
    queries.map((query) =>
      searchSellCatalogHitsFromElasticsearch(query, {
        limit: 15,
        categories,
      }),
    ),
  )

  const best = new Map<string, SellCatalogEsHit>()
  lists.forEach((hits, index) => {
    const weight = QUERY_WEIGHTS[index] ?? 1
    for (const hit of hits) {
      const key = `${hit.kind}:${hit.id}`
      const score = hit.score * weight
      const previous = best.get(key)
      if (!previous || score > previous.score) {
        best.set(key, { ...hit, score })
      }
    }
  })

  const hits = [...best.values()].sort((a, b) => b.score - a.score).slice(0, 24)
  return hydrateHits(supabase, hits)
}

function mergeCandidates(
  lists: readonly (readonly SellPhotoCatalogCandidate[])[],
): SellPhotoCatalogCandidate[] {
  const best = new Map<string, SellPhotoCatalogCandidate>()
  for (const list of lists) {
    for (const candidate of list) {
      const key = `${candidate.row.kind}-${candidate.row.id}`
      const previous = best.get(key)
      if (!previous || candidate.esScore > previous.esScore) best.set(key, candidate)
    }
  }
  return [...best.values()]
}

async function postgresFallbackCandidates(
  supabase: SupabaseClient,
  query: string,
): Promise<{ candidates: SellPhotoCatalogCandidate[]; backend: "elasticsearch" | "supabase" }> {
  const result = await searchSellCatalogForSell(supabase, query, {
    categories: sellPhotoMatchSearchCategories(),
  })
  const rows = result.results.length > 0 ? result.results : result.similarResults
  return {
    candidates: rows.map((row) => ({ row, esScore: 0 })),
    backend: result.meta.backend,
  }
}

/**
 * Match a photo observation to surfboard catalog rows.
 * Readable text uses the lexical sell-catalog index.
 * Photo nearest neighbors are kept only when they agree with a readable brand,
 * or when one board is clearly closer than the rest.
 * Postgres only hydrates those ids, and is the fallback when the index has no hits.
 */
export async function matchSellPhotoToCatalog(
  supabase: SupabaseClient,
  observation: SellPhotoObservation,
  vector: readonly number[] | null,
): Promise<SellPhotoCatalogMatch> {
  const queries = sellPhotoCatalogQueries(observation)
  const lookupQuery = queries[0] ?? null
  if (!lookupQuery && !vector) {
    return { rows: [], matchTier: "none", backend: null, lookupQuery: null, usedEmbedding: false }
  }

  if (!isElasticsearchConfigured()) {
    if (!lookupQuery) {
      return { rows: [], matchTier: "none", backend: null, lookupQuery: null, usedEmbedding: false }
    }
    console.warn("[sellPhotoMatch] Elasticsearch is not configured; using catalog fallback")
    const fallback = await postgresFallbackCandidates(supabase, lookupQuery)
    const ranked = rankSellPhotoCatalogRows(observation, fallback.candidates)
    return { ...ranked, backend: fallback.backend, lookupQuery, usedEmbedding: false }
  }

  const [lexical, visual] = await Promise.all([
    lookupQuery ? elasticsearchCandidates(supabase, queries) : Promise.resolve([]),
    vector ? vectorCandidates(supabase, observation, vector) : Promise.resolve([]),
  ])

  let candidates = mergeCandidates([lexical, visual])
  let backend: "elasticsearch" | "supabase" | null = "elasticsearch"
  const usedEmbedding = visual.length > 0
  if (candidates.length === 0 && lookupQuery) {
    console.warn("[sellPhotoMatch] Elasticsearch returned no catalog hits; using fallback", {
      queries,
    })
    const fallback = await postgresFallbackCandidates(supabase, lookupQuery)
    candidates = fallback.candidates
    backend = fallback.backend
  }

  const ranked = rankSellPhotoCatalogRows(observation, candidates)
  console.info("[sellPhotoMatch] catalog", {
    backend,
    queries,
    embedding: usedEmbedding,
    matchTier: ranked.matchTier,
    rows: ranked.rows.length,
  })
  return { ...ranked, backend, lookupQuery, usedEmbedding }
}
