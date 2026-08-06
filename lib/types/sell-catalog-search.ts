import {
  brandProductCategoryLabel,
  type BrandProductCategorySlug,
} from "@/lib/brand-product-categories"

/**
 * Categories the `/sell` cross-category catalog search can route into.
 * Must stay in sync with the sell paths exposed by the `/sell` type chooser.
 */
export const SELL_CATALOG_SEARCH_CATEGORIES = [
  "surfboards",
  "fins",
  "wetsuits",
  "apparel",
] as const satisfies readonly BrandProductCategorySlug[]

export type SellCatalogSearchCategory = (typeof SELL_CATALOG_SEARCH_CATEGORIES)[number]

const CATEGORY_SET = new Set<string>(SELL_CATALOG_SEARCH_CATEGORIES)

export function isSellCatalogSearchCategory(
  value: string,
): value is SellCatalogSearchCategory {
  return CATEGORY_SET.has(value)
}

/** Sell-flow entry URL for a catalog search selection in the given category. */
export function sellCatalogSearchCategorySellPath(
  category: SellCatalogSearchCategory,
): string {
  switch (category) {
    case "surfboards":
      return "/sell/boards?new=1"
    case "fins":
      return "/sell/fins?new=1"
    case "wetsuits":
      return "/sell/wetsuits"
    case "apparel":
      return "/sell/apparel"
  }
}

export function sellCatalogSearchCategoryLabel(
  category: SellCatalogSearchCategory,
): string {
  return brandProductCategoryLabel(category)
}

export type SellCatalogSearchBrandRow = {
  kind: "brand"
  id: string
  name: string
  slug: string
  logoUrl: string | null
  shortDescription: string | null
  category: SellCatalogSearchCategory
}

export type SellCatalogSearchModelRow = {
  kind: "model"
  id: string
  name: string
  brandId: string
  brandName: string
  brandSlug: string
  brandLogoUrl: string | null
  imageUrl: string | null
  description: string | null
  category: SellCatalogSearchCategory
}

export type SellCatalogSearchVariantRow = {
  kind: "variant"
  id: string
  brandId: string
  brandModelId: string
  brandName: string
  brandSlug: string
  brandLogoUrl: string | null
  modelName: string
  modelDescription: string | null
  modelImageUrl: string | null
  finSetup: string
  finSystem: string
  finSize: string | null
  variantLabel: string
  imageUrl: string | null
  suggestedTitle: string
  category: "fins"
}

export type SellCatalogSearchResultRow =
  | SellCatalogSearchBrandRow
  | SellCatalogSearchModelRow
  | SellCatalogSearchVariantRow

export type SellCatalogSearchMatchTier = "exact" | "similar" | "none"

export type SellCatalogSearchResult = {
  results: SellCatalogSearchResultRow[]
  similarResults: SellCatalogSearchResultRow[]
  meta: {
    backend: "elasticsearch" | "supabase"
    matchTier: SellCatalogSearchMatchTier
  }
}

export function sellCatalogSearchRowCategory(
  row: SellCatalogSearchResultRow,
): SellCatalogSearchCategory {
  return row.kind === "brand" ? row.category : row.category
}

export function sellCatalogSearchRowTitle(row: SellCatalogSearchResultRow): string {
  if (row.kind === "brand") return row.name
  if (row.kind === "model") return `${row.brandName} ${row.name}`
  return `${row.brandName} ${row.modelName}`
}

export function sellCatalogSearchRowBrandName(row: SellCatalogSearchResultRow): string {
  return row.kind === "brand" ? row.name : row.brandName
}

export function sellCatalogSearchRowModelName(row: SellCatalogSearchResultRow): string | null {
  if (row.kind === "brand") return null
  if (row.kind === "model") return row.name
  return row.modelName
}
