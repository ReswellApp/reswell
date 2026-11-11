import {
  MOBILE_BOARD_TYPES,
  MOBILE_SELL_CATALOG_CATEGORIES,
  mobileSellCatalogSearchSchema,
  type MobileBoardType,
  type MobileSellCatalogSearch,
} from "@reswell/api-contract"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import type { BrandCatalogSuggestRow } from "@/lib/services/brandDirectorySearch"
import { getMobileSellTaxonomy } from "@/lib/services/mobileSellTaxonomy"
import type { SellCatalogSearchResult, SellCatalogSearchResultRow } from "@/lib/types/sell-catalog-search"

const BOARD_TYPES = new Set<string>(MOBILE_BOARD_TYPES)
const CATALOG_CATEGORIES = new Set<string>(MOBILE_SELL_CATALOG_CATEGORIES)

/** Catalog shape slugs use a few aliases of the board-style filter values. */
export function boardTypeFromCatalogSlug(value: string | null | undefined): MobileBoardType | null {
  if (!value) return null
  const trimmed = value.trim()
  const normalized =
    trimmed === "mid-length" || trimmed === "funboard"
      ? "hybrid"
      : trimmed === "step-up" || trimmed === "gun"
        ? "step-up-gun"
        : trimmed
  return BOARD_TYPES.has(normalized) ? (normalized as MobileBoardType) : null
}

function catalogCategory(value: string): (typeof MOBILE_SELL_CATALOG_CATEGORIES)[number] | null {
  return CATALOG_CATEGORIES.has(value) ? (value as (typeof MOBILE_SELL_CATALOG_CATEGORIES)[number]) : null
}

function taxonomyLabels(): Map<string, string> {
  return new Map(getMobileSellTaxonomy().categories.map((category) => [category.slug, category.label]))
}

/** First sell-form category this brand is tagged with; surfboards if none match. */
export function mobileCategoryForBrand(
  slugs: readonly BrandProductCategorySlug[],
): (typeof MOBILE_SELL_CATALOG_CATEGORIES)[number] {
  for (const slug of MOBILE_SELL_CATALOG_CATEGORIES) {
    if (slugs.includes(slug)) return slug
  }
  return "surfboards"
}

function mapRow(
  row: SellCatalogSearchResultRow,
  labels: ReadonlyMap<string, string>,
): MobileSellCatalogSearch["results"][number] | null {
  const category = catalogCategory(row.category)
  const categoryLabel = category ? labels.get(category) : undefined
  if (!category || !categoryLabel) return null

  if (row.kind === "brand") {
    return {
      kind: "brand",
      id: row.id,
      brand_id: row.id,
      brand_name: row.name,
      model_name: null,
      category,
      category_label: categoryLabel,
      board_type: null,
      image_url: row.logoUrl,
      title: row.name,
    }
  }

  if (row.kind === "model") {
    const title = `${row.brandName} ${row.name}`.trim()
    return {
      kind: "model",
      id: row.id,
      brand_id: row.brandId,
      brand_name: row.brandName,
      model_name: row.name,
      category,
      category_label: categoryLabel,
      board_type: boardTypeFromCatalogSlug(row.boardCategorySlug),
      image_url: row.imageUrl,
      title,
    }
  }

  return {
    kind: "variant",
    id: row.id,
    brand_id: row.brandId,
    brand_name: row.brandName,
    model_name: row.modelName,
    category,
    category_label: categoryLabel,
    board_type: null,
    image_url: row.imageUrl,
    title: row.suggestedTitle.trim() || `${row.brandName} ${row.modelName}`.trim(),
  }
}

/** Mobile shape of the website sell catalog search. Exact matches win; similar matches are the fallback. */
export function mapMobileSellCatalog(result: SellCatalogSearchResult): MobileSellCatalogSearch {
  const labels = taxonomyLabels()
  const rows = result.meta.matchTier === "similar" ? result.similarResults : result.results
  return mobileSellCatalogSearchSchema.parse({
    results: rows.flatMap((row) => {
      const mapped = mapRow(row, labels)
      return mapped ? [mapped] : []
    }),
  })
}

/**
 * Website sell-form brand typeahead (`searchBrandsCatalogSuggest`) → mobile rows.
 * Brands only — models belong on `/catalog-search/brand-models`.
 */
export function mapMobileSellBrandSuggest(
  rows: readonly BrandCatalogSuggestRow[],
  categoryByBrandId: ReadonlyMap<string, readonly BrandProductCategorySlug[]>,
): MobileSellCatalogSearch {
  const labels = taxonomyLabels()
  return mobileSellCatalogSearchSchema.parse({
    results: rows.flatMap((row) => {
      const name = row.name.trim()
      if (!name) return []
      const category = mobileCategoryForBrand(categoryByBrandId.get(row.id) ?? [])
      const categoryLabel = labels.get(category)
      if (!categoryLabel) return []
      return [
        {
          kind: "brand" as const,
          id: row.id,
          brand_id: row.id,
          brand_name: name,
          model_name: null,
          category,
          category_label: categoryLabel,
          board_type: null,
          image_url: row.logo_url?.trim() || null,
          title: name,
        },
      ]
    }),
  })
}

/** Brand drill-in models — same rows as website `/api/sell/catalog-search/brand-models`. */
export function mapMobileSellBrandModels(
  rows: readonly SellCatalogSearchResultRow[],
): MobileSellCatalogSearch {
  const labels = taxonomyLabels()
  return mobileSellCatalogSearchSchema.parse({
    results: rows.flatMap((row) => {
      const mapped = mapRow(row, labels)
      return mapped && mapped.kind === "model" ? [mapped] : []
    }),
  })
}
