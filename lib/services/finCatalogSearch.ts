import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listFinCatalogBrandIds,
  listFinCatalogModelsForBrandIds,
  searchFinCatalogBrands,
  searchFinCatalogModels,
  searchFinCatalogVariants,
  type FinCatalogModelRow,
  type FinCatalogVariantRow,
} from "@/lib/db/fin-catalog-search"
import {
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS_FOR_FINS,
  FIN_SIZE_OPTIONS,
} from "@/lib/fin-listing-config"
import { FIN_LISTING_TITLE_MAX_LENGTH } from "@/lib/validations/fin-listing"
import { searchBrandsCatalogSuggestWithClient } from "@/lib/services/brandDirectorySearch"
import type { BrandCatalogSuggestRow } from "@/lib/services/brandDirectorySearch"
import { formatFinCatalogVariantLabel } from "@/lib/utils/fin-catalog-variant-label"
import { finCatalogSearchRowThumbUrl } from "@/lib/utils/fin-catalog-display-image"
import type {
  FinCatalogSearchBrandRow,
  FinCatalogSearchModelRow,
  FinCatalogSearchResult,
  FinCatalogSearchVariantRow,
} from "@/lib/types/fin-catalog-search"
import type { FinBoxesType, FinBoxType } from "@/lib/validations/brand-model-variants"

export type {
  FinCatalogSearchBrandRow,
  FinCatalogSearchModelRow,
  FinCatalogSearchResult,
  FinCatalogSearchSelection,
  FinCatalogSearchVariantRow,
} from "@/lib/types/fin-catalog-search"

const MAX_BRANDS = 8
const MAX_MODELS = 10
const MAX_VARIANTS = 12

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

function brandToSearchRow(row: BrandCatalogSuggestRow): FinCatalogSearchBrandRow {
  return {
    kind: "brand",
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url?.trim() || null,
    shortDescription: row.short_description?.trim() || null,
  }
}

function modelToSearchRow(row: FinCatalogModelRow): FinCatalogSearchModelRow {
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
    modelImageUrl: row.modelImageUrl,
    finSetup,
    finSystem,
    finSize: row.finSize,
    variantLabel,
    imageUrl: row.imageUrl,
    suggestedTitle,
  }
}

function mergeBrandsById(rows: BrandCatalogSuggestRow[]): FinCatalogSearchBrandRow[] {
  const byId = new Map<string, FinCatalogSearchBrandRow>()
  for (const row of rows) {
    byId.set(row.id, brandToSearchRow(row))
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

/**
 * Search the brand/model/variant catalog for the `/sell/fins` entry step.
 * Results are limited to brands tagged with the `fins` product category slug.
 */
export async function searchFinCatalogForSell(
  supabase: SupabaseClient,
  qRaw: string,
): Promise<FinCatalogSearchResult> {
  const q = (qRaw || "").trim().replace(/%/g, "")
  if (q.length < 1) {
    return {
      brands: [],
      models: [],
      variants: [],
      meta: { backend: "supabase", finBrandCount: 0 },
    }
  }

  const finBrandIds = await listFinCatalogBrandIds(supabase)
  if (finBrandIds.length === 0) {
    return {
      brands: [],
      models: [],
      variants: [],
      meta: { backend: "supabase", finBrandCount: 0 },
    }
  }

  const finBrandIdSet = new Set(finBrandIds)
  const { finSystems, finSetups, finSizes } = extractFinFacetMatches(q)

  const [brandRes, finScopedBrands] = await Promise.all([
    searchBrandsCatalogSuggestWithClient(supabase, q),
    searchFinCatalogBrands(supabase, finBrandIds, q, MAX_BRANDS),
  ])

  const brands = mergeBrandsById([
    ...brandRes.rows.filter((row) => finBrandIdSet.has(row.id)),
    ...finScopedBrands,
  ])

  const matchedBrandIds = brands.map((b) => b.id)

  const [modelsByText, modelsForBrands] = await Promise.all([
    searchFinCatalogModels(supabase, finBrandIds, q, MAX_MODELS),
    matchedBrandIds.length > 0
      ? listFinCatalogModelsForBrandIds(supabase, finBrandIds, matchedBrandIds, "", MAX_MODELS)
      : Promise.resolve([]),
  ])

  const models = mergeModelsById([...modelsByText, ...modelsForBrands])
  const modelIds = models.map((m) => m.id)

  const variantRows = await searchFinCatalogVariants(supabase, {
    finBrandIds,
    qRaw: q,
    finSystems,
    finSetups,
    finSizes,
    brandModelIds: modelIds,
    limit: MAX_VARIANTS,
  })

  const variants = variantRows.map(variantToSearchRow)

  return {
    brands,
    models,
    variants,
    meta: { backend: brandRes.meta.backend, finBrandCount: finBrandIds.length },
  }
}
