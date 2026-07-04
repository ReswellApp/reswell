import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listFinCatalogBrandIds,
  listFinCatalogModelsForBrandIds,
  searchFinCatalogBrands,
  searchFinCatalogModels,
  searchFinCatalogModelsBroad,
  searchFinCatalogVariants,
  type FinCatalogBrandRow,
  type FinCatalogModelRow,
  type FinCatalogVariantRow,
} from "@/lib/db/fin-catalog-search"
import {
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS_FOR_FINS,
  FIN_SIZE_OPTIONS,
} from "@/lib/fin-listing-config"
import { FIN_LISTING_TITLE_MAX_LENGTH } from "@/lib/validations/fin-listing"
import type { BrandCatalogSuggestResponse } from "@/lib/services/brandDirectorySearch"
import {
  searchBrandsCatalogSuggestWithClient,
  type BrandCatalogSuggestRow,
} from "@/lib/services/brandDirectorySearch"
import { formatFinCatalogVariantLabel } from "@/lib/utils/fin-catalog-variant-label"
import { rankFinCatalogSearchResults } from "@/lib/utils/fin-catalog-search-rank"
import type {
  FinCatalogSearchBrandRow,
  FinCatalogSearchModelRow,
  FinCatalogSearchResult,
  FinCatalogSearchResultRow,
  FinCatalogSearchVariantRow,
} from "@/lib/types/fin-catalog-search"
import type { FinBoxesType, FinBoxType } from "@/lib/validations/brand-model-variants"

export type {
  FinCatalogSearchBrandRow,
  FinCatalogSearchModelRow,
  FinCatalogSearchResult,
  FinCatalogSearchResultRow,
  FinCatalogSearchSelection,
  FinCatalogSearchVariantRow,
} from "@/lib/types/fin-catalog-search"

const MAX_BRANDS = 8
const MAX_FIN_BRAND_SUGGEST = 20
const MAX_MODELS = 20
const MAX_VARIANTS = 24
const MAX_RANKED_RESULTS = 12

function finCatalogBrandRowToSuggestRow(row: FinCatalogBrandRow): BrandCatalogSuggestRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    short_description: row.short_description,
    logo_url: row.logo_url,
    location_label: row.location_label,
    lead_shaper_name: row.lead_shaper_name,
  }
}

function mergeFinBrandSuggestRows(
  catalogRows: BrandCatalogSuggestRow[],
  finScopedRows: FinCatalogBrandRow[],
  limit = MAX_FIN_BRAND_SUGGEST,
): BrandCatalogSuggestRow[] {
  const byId = new Map<string, BrandCatalogSuggestRow>()
  for (const row of catalogRows) {
    byId.set(row.id, row)
  }
  for (const row of finScopedRows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, finCatalogBrandRowToSuggestRow(row))
    }
  }
  return [...byId.values()].slice(0, limit)
}

/**
 * Brand directory typeahead for `/sell/fins` — same pipeline as surfboard sell, scoped to
 * brands tagged with the `fins` product category.
 */
export async function searchFinBrandsCatalogSuggestWithClient(
  supabase: SupabaseClient,
  qRaw: string,
): Promise<BrandCatalogSuggestResponse> {
  const q = (qRaw || "").trim().replace(/%/g, "")
  if (q.length < 1) {
    return { rows: [], meta: { backend: "supabase" } }
  }

  const finBrandIds = await listFinCatalogBrandIds(supabase)
  if (finBrandIds.length === 0) {
    return { rows: [], meta: { backend: "supabase" } }
  }

  const finBrandIdSet = new Set(finBrandIds)

  const [brandRes, finScopedBrands] = await Promise.all([
    searchBrandsCatalogSuggestWithClient(supabase, q),
    searchFinCatalogBrands(supabase, finBrandIds, q, MAX_FIN_BRAND_SUGGEST),
  ])

  const rows = mergeFinBrandSuggestRows(
    brandRes.rows.filter((row) => finBrandIdSet.has(row.id)),
    finScopedBrands,
  )

  return { rows, meta: brandRes.meta }
}

function extractFinFacetMatches(q: string): {
  finSystems: FinBoxType[]
  finSetups: FinBoxesType[]
  finSizes: string[]
} {
  const lower = q.toLowerCase()
  const finSystems = FIN_SYSTEM_OPTIONS_FOR_FINS.filter(
    (o) =>
      lower.includes(o.label.toLowerCase()) ||
      lower.includes(o.value.replace(/_/g, " ")) ||
      lower.includes(o.value),
  ).map((o) => o.value as FinBoxType)

  const finSetups = FIN_SETUP_OPTIONS.filter(
    (o) => lower.includes(o.label.toLowerCase()) || lower.includes(o.value),
  ).map((o) => o.value as FinBoxesType)

  const finSizes = FIN_SIZE_OPTIONS.filter(
    (o) => lower.includes(o.label.toLowerCase()) || lower.includes(o.value),
  ).map((o) => o.value)

  return { finSystems, finSetups, finSizes }
}

function capTitle(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ")
  return t.length <= FIN_LISTING_TITLE_MAX_LENGTH
    ? t
    : t.slice(0, FIN_LISTING_TITLE_MAX_LENGTH).trimEnd()
}

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

function variantToSearchRow(row: FinCatalogVariantRow): FinCatalogSearchVariantRow {
  const finSystem = row.finBoxType
  const finSetup = row.finBoxes
  const variantLabel = formatFinCatalogVariantLabel({
    fin_size: row.finSize,
    configuration_label: row.configurationLabel,
    fin_box_type: finSystem,
    fin_boxes: finSetup,
    fin_base_label: row.finBaseLabel,
    fin_height_label: row.finHeightLabel,
    fin_foil_label: row.finFoilLabel,
    fin_color_label: row.finColorLabel,
  })

  const suggestedTitle = capTitle(`${row.brandName} ${row.modelName}`)

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
    finSetup,
    finSystem,
    finSize: row.finSize,
    variantLabel,
    imageUrl: row.imageUrl,
    suggestedTitle,
  }
}

function finCatalogBrandToSearchRow(row: FinCatalogBrandRow): FinCatalogSearchBrandRow {
  return {
    kind: "brand",
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url?.trim() || null,
    shortDescription: row.short_description?.trim() || null,
  }
}

function mergeBrandsById(rows: FinCatalogBrandRow[]): FinCatalogSearchBrandRow[] {
  const byId = new Map<string, FinCatalogSearchBrandRow>()
  for (const row of rows) {
    byId.set(row.id, finCatalogBrandToSearchRow(row))
  }
  return [...byId.values()].slice(0, MAX_BRANDS)
}

function mergeModelsById(rows: FinCatalogModelRow[]): FinCatalogSearchModelRow[] {
  const byId = new Map<string, FinCatalogSearchModelRow>()
  for (const row of rows) {
    byId.set(row.id, modelToSearchRow(row))
  }
  return [...byId.values()].slice(0, MAX_MODELS)
}

export type SearchFinCatalogForSellOptions = {
  /** Preloaded fin-tagged brand IDs (from `getFinCatalogBrandIdsCached`). */
  finBrandIds?: readonly string[]
}

/**
 * Search the brand/model/variant catalog for the `/sell/fins` entry step.
 * Results are limited to brands tagged with the `fins` product category slug.
 */
export async function searchFinCatalogForSell(
  supabase: SupabaseClient,
  qRaw: string,
  options: SearchFinCatalogForSellOptions = {},
): Promise<FinCatalogSearchResult> {
  const q = (qRaw || "").trim().replace(/%/g, "")
  if (q.length < 1) {
    return {
      brands: [],
      models: [],
      variants: [],
      results: [],
      similarResults: [],
      meta: { backend: "supabase", finBrandCount: 0, matchTier: "none" },
    }
  }

  const finBrandIds =
    options.finBrandIds ?? (await listFinCatalogBrandIds(supabase))
  if (finBrandIds.length === 0) {
    return {
      brands: [],
      models: [],
      variants: [],
      results: [],
      similarResults: [],
      meta: { backend: "supabase", finBrandCount: 0, matchTier: "none" },
    }
  }

  const { finSystems, finSetups, finSizes } = extractFinFacetMatches(q)

  const [finScopedBrands, modelsByText, variantRows] = await Promise.all([
    searchFinCatalogBrands(supabase, finBrandIds, q, MAX_BRANDS),
    searchFinCatalogModels(supabase, finBrandIds, q, MAX_MODELS),
    searchFinCatalogVariants(supabase, {
      finBrandIds,
      qRaw: q,
      finSystems,
      finSetups,
      finSizes,
      limit: MAX_VARIANTS,
    }),
  ])

  const brands = mergeBrandsById(finScopedBrands)
  const matchedBrandIds = brands.map((b) => b.id)

  const modelsForBrands =
    matchedBrandIds.length > 0
      ? await listFinCatalogModelsForBrandIds(supabase, finBrandIds, matchedBrandIds, q, MAX_MODELS)
      : []

  const models = mergeModelsById([...modelsByText, ...modelsForBrands])
  const modelIds = models.map((m) => m.id)

  const variantRowsForModels =
    modelIds.length > 0
      ? await searchFinCatalogVariants(supabase, {
          finBrandIds,
          qRaw: q,
          finSystems,
          finSetups,
          finSizes,
          brandModelIds: modelIds,
          limit: MAX_VARIANTS,
        })
      : []
  const variants = [...variantRows, ...variantRowsForModels]
    .filter((row, index, all) => all.findIndex((r) => r.id === row.id) === index)
    .slice(0, MAX_VARIANTS)
    .map(variantToSearchRow)

  const candidateRows: FinCatalogSearchResultRow[] = [
    ...brands,
    ...models,
    ...variants,
  ]
  const results = rankFinCatalogSearchResults(q, candidateRows, MAX_RANKED_RESULTS, "strict")

  let similarResults: FinCatalogSearchResultRow[] = []
  let matchTier: "exact" | "similar" | "none" = results.length > 0 ? "exact" : "none"

  if (results.length === 0) {
    const [broadModels, brandCatalogModels] = await Promise.all([
      searchFinCatalogModelsBroad(supabase, finBrandIds, q, MAX_MODELS),
      matchedBrandIds.length > 0
        ? listFinCatalogModelsForBrandIds(supabase, finBrandIds, matchedBrandIds, "", MAX_MODELS)
        : Promise.resolve([]),
    ])

    const broadModelRows = mergeModelsById([...broadModels, ...brandCatalogModels])
    const broadModelIds = broadModelRows.map((m) => m.id)

    const broadVariantRows =
      broadModelIds.length > 0
        ? await searchFinCatalogVariants(supabase, {
            finBrandIds,
            qRaw: q,
            finSystems,
            finSetups,
            finSizes,
            brandModelIds: broadModelIds,
            limit: MAX_VARIANTS,
          })
        : []

    const fallbackCandidates: FinCatalogSearchResultRow[] = [
      ...brands,
      ...broadModelRows,
      ...broadVariantRows.map(variantToSearchRow),
    ]

    similarResults = rankFinCatalogSearchResults(
      q,
      fallbackCandidates,
      MAX_RANKED_RESULTS,
      "relaxed",
    )
    if (similarResults.length > 0) matchTier = "similar"
  }

  return {
    brands,
    models,
    variants,
    results,
    similarResults,
    meta: { backend: "supabase", finBrandCount: finBrandIds.length, matchTier },
  }
}
