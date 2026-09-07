import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getFinCatalogBrandIdsCached } from "@/lib/cache/fin-catalog-brand-ids"
import {
  getSellCatalogBrandRowsByIds,
  getSellCatalogModelRowsByIds,
  listSellCatalogModelRowsByBrandIds,
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
import {
  parseSellCatalogSearchIntent,
  resolveSellCatalogSearchCategories,
  sellCatalogSearchCategoryRank,
} from "@/lib/utils/sell-catalog-search-intent"
import type { FinCatalogSearchResultRow } from "@/lib/types/fin-catalog-search"
import {
  SELL_CATALOG_SEARCH_CATEGORIES,
  type SellCatalogSearchCategory,
  type SellCatalogSearchResult,
  type SellCatalogSearchResultRow,
  type SellCatalogSearchVariantRow,
} from "@/lib/types/sell-catalog-search"

const MAX_RANKED_RESULTS = 20

/** Catalog rows that are really used-listing titles, not sellable models. */
function catalogModelLooksLikeListingTitle(name: string): boolean {
  const n = name.trim().toLowerCase()
  if (!n) return false
  if (/\bused\b/.test(n)) return true
  if (/\bteam board\b/.test(n)) return true
  if (/^\d+\s*\/\s*\d+/.test(n)) return true
  return false
}

function rowLooksLikeListingTitle(row: SellCatalogSearchResultRow): boolean {
  if (row.kind === "model") return catalogModelLooksLikeListingTitle(row.name)
  if (row.kind === "variant") return catalogModelLooksLikeListingTitle(row.modelName)
  return false
}
/** Single-letter typeahead: skip ES + fin variants; prefix `ilike` is enough. */
const SHORT_PREFIX_MAX_LEN = 1
/** Pull every model for an ES brand hit only once the query looks like a real name. */
const BRAND_MODEL_BACKFILL_MIN_LEN = 4

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
  const intent = parseSellCatalogSearchIntent(q)
  const scoped =
    intent.lockedCategory && rows.some((row) => row.category === intent.lockedCategory)
      ? rows.filter((row) => row.category === intent.lockedCategory)
      : rows

  const finCandidates = scoped
    .map(sellRowToFinRankRow)
    .filter((row): row is FinCatalogSearchResultRow => row !== null)
  const rankedFin = rankFinCatalogSearchResults(q, finCandidates, limit * 3, mode)
  const byKey = new Map(scoped.map((row) => [`${row.kind}-${row.id}`, row] as const))

  const out: SellCatalogSearchResultRow[] = []
  for (const finRow of rankedFin) {
    const sellRow = byKey.get(`${finRow.kind}-${finRow.id}`)
    if (sellRow) out.push(sellRow)
  }

  const preferred = intent.lockedCategory ?? intent.preferredCategory
  const hasPreferredProduct = Boolean(
    preferred && out.some((row) => row.category === preferred && row.kind !== "brand"),
  )
  const narrowed =
    preferred && hasPreferredProduct
      ? out.filter((row) => row.kind === "brand" || row.category === preferred)
      : out

  narrowed.sort((a, b) => {
    const brandDelta = Number(b.kind === "brand") - Number(a.kind === "brand")
    if (brandDelta !== 0) return brandDelta
    const listingDelta = Number(rowLooksLikeListingTitle(a)) - Number(rowLooksLikeListingTitle(b))
    if (listingDelta !== 0) return listingDelta
    if (!preferred) return 0
    return (
      sellCatalogSearchCategoryRank(a.category, intent) -
      sellCatalogSearchCategoryRank(b.category, intent)
    )
  })

  return narrowed.slice(0, limit)
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
 * Returns `null` when ES is unavailable or has no hits — callers still
 * merge Supabase `ilike` rows so newly-imported models are not hidden
 * behind a stale index.
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
    const modelHits = hits.filter((h) => h.kind === "model")
    // Short prefixes match every model under a brand via `brand_name.edge`
    // ("ch" → every Channel Islands board). Cap hydration so typeahead
    // stays fast and brands are not buried under a catalog dump.
    const modelIds = (
      q.length < BRAND_MODEL_BACKFILL_MIN_LEN ? modelHits.slice(0, 8) : modelHits
    ).map((h) => h.id)

    const backfillBrandModels =
      brandIds.length > 0 && compactSearchKey(q).length >= BRAND_MODEL_BACKFILL_MIN_LEN

    const [brands, models, modelsForBrands] = await Promise.all([
      getSellCatalogBrandRowsByIds(supabase, brandIds, nonFinCategories),
      getSellCatalogModelRowsByIds(supabase, modelIds, nonFinCategories),
      // Mirror fin catalog: when ES resolves a brand (incl. synonyms), pull
      // that brand's models from Postgres so recent imports appear before the
      // hourly `reswell_sell_catalog` reindex catches up. Skip on short
      // prefixes — "c" matching Channel Islands would otherwise load 40 models.
      backfillBrandModels
        ? listSellCatalogModelRowsByBrandIds(supabase, brandIds, nonFinCategories, 40)
        : Promise.resolve([]),
    ])

    const byKey = new Map<string, SellCatalogSearchResultRow>()
    for (const row of [...brands, ...models, ...modelsForBrands]) {
      byKey.set(`${row.kind}-${row.id}`, row)
    }

    // Preserve ES relevance order after hydration, then append Postgres-only models.
    const rows: SellCatalogSearchResultRow[] = []
    const seen = new Set<string>()
    for (const hit of hits) {
      const key = `${hit.kind}-${hit.id}`
      const row = byKey.get(key)
      if (row) {
        rows.push(row)
        seen.add(key)
      }
    }
    for (const row of modelsForBrands) {
      const key = `${row.kind}-${row.id}`
      if (seen.has(key)) continue
      rows.push(row)
      seen.add(key)
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

async function loadSupabaseNonFinRows(
  supabase: SupabaseClient,
  q: string,
  nonFinCategories: readonly SellCatalogSearchCategory[],
): Promise<SellCatalogSearchResultRow[]> {
  if (nonFinCategories.length === 0) return []
  const [brands, models] = await Promise.all([
    searchSellCatalogBrandRows(supabase, q, nonFinCategories),
    searchSellCatalogModelRows(supabase, q, nonFinCategories),
  ])
  return [...brands, ...models]
}

async function loadFinCatalogRows(
  supabase: SupabaseClient,
  q: string,
  categories: readonly SellCatalogSearchCategory[],
): Promise<{
  exact: SellCatalogSearchResultRow[]
  similar: SellCatalogSearchResultRow[]
  backend: "elasticsearch" | "supabase"
}> {
  if (!categories.includes("fins")) {
    return { exact: [], similar: [], backend: "supabase" }
  }
  const finBrandIds = await getFinCatalogBrandIdsCached()
  const finResult = await searchFinCatalogForSell(supabase, q, { finBrandIds })
  return {
    exact: finResult.results.map(mapFinRowToSellRow),
    similar: finResult.similarResults.map(mapFinRowToSellRow),
    backend: finResult.meta.backend,
  }
}

/**
 * Single-letter typeahead: two prefix `ilike` queries across every requested
 * category. ES edge-ngrams start at 2 chars and the fin-variant pipeline is
 * wasted work for a single letter. Two-letter queries (e.g. "ci") still use
 * the full path so catalog synonyms can resolve.
 */
async function searchSellCatalogPrefixFast(
  supabase: SupabaseClient,
  q: string,
  categories: readonly SellCatalogSearchCategory[],
): Promise<SellCatalogSearchResult> {
  const [brands, models] = await Promise.all([
    searchSellCatalogBrandRows(supabase, q, categories),
    searchSellCatalogModelRows(supabase, q, categories),
  ])
  const rows = mergeRowsByKey([...brands, ...models])
  const results = rankSellCatalogResults(q, rows, MAX_RANKED_RESULTS, "strict")
  if (results.length > 0) {
    return {
      results,
      similarResults: [],
      meta: { backend: "supabase", matchTier: "exact" },
    }
  }
  const similarResults = rankSellCatalogResults(q, rows, MAX_RANKED_RESULTS, "relaxed")
  if (similarResults.length > 0) {
    return {
      results: [],
      similarResults,
      meta: { backend: "supabase", matchTier: "similar" },
    }
  }
  return emptyResult()
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
  const intent = parseSellCatalogSearchIntent(q)
  const categories = resolveSellCatalogSearchCategories(
    options?.categories ?? SELL_CATALOG_SEARCH_CATEGORIES,
    intent,
  )
  if (q.length < 1 || categories.length === 0) {
    return emptyResult()
  }

  if (q.length <= SHORT_PREFIX_MAX_LEN) {
    return searchSellCatalogPrefixFast(supabase, q, categories)
  }

  const nonFinCategories = categories.filter((c) => c !== "fins")
  const [nonFinEsRows, finRows, supabaseRows] = await Promise.all([
    loadNonFinRowsFromElasticsearch(supabase, q, nonFinCategories),
    loadFinCatalogRows(supabase, q, categories),
    loadSupabaseNonFinRows(supabase, q, nonFinCategories),
  ])

  const backend: "elasticsearch" | "supabase" =
    nonFinEsRows || finRows.backend === "elasticsearch" ? "elasticsearch" : "supabase"

  const exactCandidates = mergeRowsByKey([
    ...finRows.exact,
    ...(nonFinEsRows ?? []),
    ...supabaseRows,
  ])
  const results = rankSellCatalogResults(q, exactCandidates, MAX_RANKED_RESULTS, "strict")

  if (results.length > 0) {
    return {
      results,
      similarResults: [],
      meta: { backend, matchTier: "exact" },
    }
  }

  const broadModels =
    nonFinCategories.length > 0
      ? await searchSellCatalogModelRowsBroad(supabase, q, nonFinCategories)
      : []
  const similarCandidates = mergeRowsByKey([
    ...exactCandidates,
    ...finRows.similar,
    ...broadModels,
  ])
  let similarResults = rankSellCatalogResults(
    q,
    similarCandidates,
    MAX_RANKED_RESULTS,
    "relaxed",
  )

  // Trust ES relevance order when the local ranker is too strict — but never
  // dump other-category keyword hits (e.g. "Keel" surfboards for "hobie keels").
  if (
    similarResults.length === 0 &&
    nonFinEsRows &&
    nonFinEsRows.length > 0 &&
    !intent.lockedCategory &&
    !intent.preferredCategory
  ) {
    similarResults = nonFinEsRows.slice(0, MAX_RANKED_RESULTS)
  }

  if (similarResults.length > 0) {
    return {
      results: [],
      similarResults,
      meta: { backend, matchTier: "similar" },
    }
  }

  return emptyResult(backend)
}

export { compactSearchKey }
