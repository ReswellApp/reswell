import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listFinCatalogBrandIds } from "@/lib/db/fin-catalog-search"
import {
  getSellCatalogBrandRowsByIds,
  getSellCatalogModelRowsByIds,
  searchSellCatalogBrandRows,
  searchSellCatalogModelRows,
  searchSellCatalogModelRowsBroad,
} from "@/lib/db/sell-catalog-search"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { searchSellCatalogHitsFromElasticsearch } from "@/lib/elasticsearch/sell-catalog-index"
import { searchFinCatalogForSell } from "@/lib/services/finCatalogSearch"
import {
  compactSearchKey,
  rankFinCatalogSearchResults,
} from "@/lib/utils/fin-catalog-search-rank"
import type { FinCatalogSearchResultRow } from "@/lib/types/fin-catalog-search"
import {
  SELL_CATALOG_SEARCH_CATEGORIES,
  type SellCatalogSearchCategory,
  type SellCatalogSearchResult,
  type SellCatalogSearchResultRow,
  type SellCatalogSearchVariantRow,
} from "@/lib/types/sell-catalog-search"

const MAX_RANKED_RESULTS = 12

function mapFinRowToSellRow(row: FinCatalogSearchResultRow): SellCatalogSearchResultRow {
  if (row.kind === "brand") {
    return {
      kind: "brand",
      id: row.id,
      name: row.name,
      slug: row.slug,
      logoUrl: row.logoUrl,
      shortDescription: row.shortDescription,
      category: "fins",
    }
  }
  if (row.kind === "model") {
    return {
      kind: "model",
      id: row.id,
      name: row.name,
      brandId: row.brandId,
      brandName: row.brandName,
      brandSlug: row.brandSlug,
      brandLogoUrl: row.brandLogoUrl,
      imageUrl: row.imageUrl,
      description: row.description,
      category: "fins",
    }
  }
  return {
    kind: "variant",
    id: row.id,
    brandId: row.brandId,
    brandModelId: row.brandModelId,
    brandName: row.brandName,
    brandSlug: row.brandSlug,
    brandLogoUrl: row.brandLogoUrl,
    modelName: row.modelName,
    modelDescription: row.modelDescription,
    modelImageUrl: row.modelImageUrl,
    finSetup: row.finSetup,
    finSystem: row.finSystem,
    finSize: row.finSize,
    variantLabel: row.variantLabel,
    imageUrl: row.imageUrl,
    suggestedTitle: row.suggestedTitle,
    category: "fins",
  }
}

function sellVariantToFinRankRow(row: SellCatalogSearchVariantRow): FinCatalogSearchResultRow {
  return {
    kind: "variant",
    id: row.id,
    brandId: row.brandId,
    brandModelId: row.brandModelId,
    brandName: row.brandName,
    brandSlug: row.brandSlug,
    brandLogoUrl: row.brandLogoUrl,
    modelName: row.modelName,
    modelDescription: row.modelDescription,
    modelImageUrl: row.modelImageUrl,
    finSetup: row.finSetup,
    finSystem: row.finSystem,
    finSize: row.finSize,
    variantLabel: row.variantLabel,
    imageUrl: row.imageUrl,
    suggestedTitle: row.suggestedTitle,
  }
}

function sellRowToFinRankRow(row: SellCatalogSearchResultRow): FinCatalogSearchResultRow | null {
  if (row.kind === "brand") {
    return {
      kind: "brand",
      id: row.id,
      name: row.name,
      slug: row.slug,
      logoUrl: row.logoUrl,
      shortDescription: row.shortDescription,
    }
  }
  if (row.kind === "model") {
    return {
      kind: "model",
      id: row.id,
      name: row.name,
      brandId: row.brandId,
      brandName: row.brandName,
      brandSlug: row.brandSlug,
      brandLogoUrl: row.brandLogoUrl,
      imageUrl: row.imageUrl,
      description: row.description,
    }
  }
  return sellVariantToFinRankRow(row)
}

function mergeRowsByKey(rows: SellCatalogSearchResultRow[]): SellCatalogSearchResultRow[] {
  const byKey = new Map<string, SellCatalogSearchResultRow>()
  for (const row of rows) {
    byKey.set(`${row.kind}-${row.id}`, row)
  }
  return [...byKey.values()]
}

function rankSellCatalogResults(
  q: string,
  rows: SellCatalogSearchResultRow[],
  limit: number,
  mode: "strict" | "relaxed",
): SellCatalogSearchResultRow[] {
  const finCandidates = rows
    .map(sellRowToFinRankRow)
    .filter((row): row is FinCatalogSearchResultRow => row !== null)
  const rankedFin = rankFinCatalogSearchResults(q, finCandidates, limit, mode)
  const byKey = new Map(rows.map((row) => [`${row.kind}-${row.id}`, row] as const))

  const out: SellCatalogSearchResultRow[] = []
  for (const finRow of rankedFin) {
    const sellRow = byKey.get(`${finRow.kind}-${finRow.id}`)
    if (sellRow) out.push(sellRow)
  }

  if (out.length >= limit) return out.slice(0, limit)

  for (const row of rows) {
    const key = `${row.kind}-${row.id}`
    if (out.some((existing) => `${existing.kind}-${existing.id}` === key)) continue
    out.push(row)
    if (out.length >= limit) break
  }

  return out.slice(0, limit)
}

function emptyResult(
  backend: "elasticsearch" | "supabase" = "supabase",
): SellCatalogSearchResult {
  return {
    results: [],
    similarResults: [],
    meta: { backend, matchTier: "none" },
  }
}

/**
 * Non-fin brand/model recall via the sell catalog Elasticsearch index
 * (synonyms, edge-prefix, fuzzy, multi-token brand+model matching).
 * Returns `null` when ES is unavailable or has no hits — callers fall
 * back to the Supabase `ilike` path.
 */
async function loadNonFinRowsFromElasticsearch(
  supabase: SupabaseClient,
  q: string,
  nonFinCategories: readonly SellCatalogSearchCategory[],
): Promise<SellCatalogSearchResultRow[] | null> {
  if (nonFinCategories.length === 0 || !isElasticsearchConfigured()) return null

  try {
    const hits = await searchSellCatalogHitsFromElasticsearch(q, {
      limit: 40,
      categories: nonFinCategories,
    })
    if (hits.length === 0) return null

    const brandIds = hits.filter((h) => h.kind === "brand").map((h) => h.id)
    const modelIds = hits.filter((h) => h.kind === "model").map((h) => h.id)

    const [brands, models] = await Promise.all([
      getSellCatalogBrandRowsByIds(supabase, brandIds, nonFinCategories),
      getSellCatalogModelRowsByIds(supabase, modelIds, nonFinCategories),
    ])

    const byKey = new Map<string, SellCatalogSearchResultRow>()
    for (const row of [...brands, ...models]) {
      byKey.set(`${row.kind}-${row.id}`, row)
    }

    // Preserve ES relevance order after hydration.
    const rows: SellCatalogSearchResultRow[] = []
    for (const hit of hits) {
      const row = byKey.get(`${hit.kind}-${hit.id}`)
      if (row) rows.push(row)
    }

    return rows.length > 0 ? rows : null
  } catch (err) {
    console.error(
      "[searchSellCatalogForSell] Elasticsearch error, falling back to Supabase:",
      err,
    )
    return null
  }
}

async function loadExactCandidates(
  supabase: SupabaseClient,
  q: string,
  categories: readonly SellCatalogSearchCategory[],
  nonFinEsRows: SellCatalogSearchResultRow[] | null,
): Promise<{ rows: SellCatalogSearchResultRow[]; backend: "elasticsearch" | "supabase" }> {
  const nonFinCategories = categories.filter((c) => c !== "fins")
  const rows: SellCatalogSearchResultRow[] = []
  let backend: "elasticsearch" | "supabase" = nonFinEsRows ? "elasticsearch" : "supabase"

  if (categories.includes("fins")) {
    const finBrandIds = await listFinCatalogBrandIds(supabase)
    const finResult = await searchFinCatalogForSell(supabase, q, { finBrandIds })
    if (finResult.meta.backend === "elasticsearch") backend = "elasticsearch"
    rows.push(...finResult.results.map(mapFinRowToSellRow))
  }

  if (nonFinEsRows) {
    rows.push(...nonFinEsRows)
  } else if (nonFinCategories.length > 0) {
    const [brands, models] = await Promise.all([
      searchSellCatalogBrandRows(supabase, q, nonFinCategories),
      searchSellCatalogModelRows(supabase, q, nonFinCategories),
    ])
    rows.push(...brands, ...models)
  }

  return { rows: mergeRowsByKey(rows), backend }
}

async function loadSimilarCandidates(
  supabase: SupabaseClient,
  q: string,
  categories: readonly SellCatalogSearchCategory[],
  nonFinEsRows: SellCatalogSearchResultRow[] | null,
): Promise<{ rows: SellCatalogSearchResultRow[]; backend: "elasticsearch" | "supabase" }> {
  const nonFinCategories = categories.filter((c) => c !== "fins")
  const rows: SellCatalogSearchResultRow[] = []
  let backend: "elasticsearch" | "supabase" = nonFinEsRows ? "elasticsearch" : "supabase"

  if (categories.includes("fins")) {
    const finBrandIds = await listFinCatalogBrandIds(supabase)
    const finResult = await searchFinCatalogForSell(supabase, q, { finBrandIds })
    if (finResult.meta.backend === "elasticsearch") backend = "elasticsearch"
    rows.push(...finResult.similarResults.map(mapFinRowToSellRow))
  }

  if (nonFinEsRows) {
    rows.push(...nonFinEsRows)
  } else if (nonFinCategories.length > 0) {
    const [brands, broadModels] = await Promise.all([
      searchSellCatalogBrandRows(supabase, q, nonFinCategories),
      searchSellCatalogModelRowsBroad(supabase, q, nonFinCategories),
    ])
    rows.push(...brands, ...broadModels)
  }

  return { rows: mergeRowsByKey(rows), backend }
}

/**
 * Cross-category catalog search backing the `/sell` "Find a match" wall.
 * Fins use the full fin catalog pipeline (brands, models, variants, ES fallback).
 * Other sell categories contribute brand + model rows from `brand_models`.
 */
export async function searchSellCatalogForSell(
  supabase: SupabaseClient,
  qRaw: string,
  options?: { categories?: readonly SellCatalogSearchCategory[] },
): Promise<SellCatalogSearchResult> {
  const q = qRaw.trim()
  const categories = options?.categories ?? SELL_CATALOG_SEARCH_CATEGORIES
  if (q.length < 1 || categories.length === 0) {
    return emptyResult()
  }

  const nonFinCategories = categories.filter((c) => c !== "fins")
  const nonFinEsRows = await loadNonFinRowsFromElasticsearch(supabase, q, nonFinCategories)

  const { rows: exactCandidates, backend } = await loadExactCandidates(
    supabase,
    q,
    categories,
    nonFinEsRows,
  )
  const results = rankSellCatalogResults(q, exactCandidates, MAX_RANKED_RESULTS, "strict")

  if (results.length > 0) {
    return {
      results,
      similarResults: [],
      meta: { backend, matchTier: "exact" },
    }
  }

  const { rows: similarCandidates, backend: similarBackend } = await loadSimilarCandidates(
    supabase,
    q,
    categories,
    nonFinEsRows,
  )
  let similarResults = rankSellCatalogResults(
    q,
    similarCandidates,
    MAX_RANKED_RESULTS,
    "relaxed",
  )

  // Trust ES relevance order when the local ranker is too strict on fuzzy hits.
  if (similarResults.length === 0 && nonFinEsRows && nonFinEsRows.length > 0) {
    similarResults = nonFinEsRows.slice(0, MAX_RANKED_RESULTS)
  }

  if (similarResults.length > 0) {
    return {
      results: [],
      similarResults,
      meta: { backend: similarBackend, matchTier: "similar" },
    }
  }

  return emptyResult(similarBackend)
}

export { compactSearchKey }
