import { FIN_LISTING_TITLE_MAX_LENGTH } from "@/lib/validations/fin-listing"

export type FinCatalogSearchBrandRow = {
  kind: "brand"
  id: string
  name: string
  slug: string
  logoUrl: string | null
  shortDescription: string | null
}

export type FinCatalogSearchModelRow = {
  kind: "model"
  id: string
  name: string
  brandId: string
  brandName: string
  brandSlug: string
  brandLogoUrl: string | null
  imageUrl: string | null
  description: string | null
}

export type FinCatalogSearchVariantRow = {
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
}

export type FinCatalogSearchResult = {
  brands: FinCatalogSearchBrandRow[]
  models: FinCatalogSearchModelRow[]
  variants: FinCatalogSearchVariantRow[]
  /** Relevance-ranked rows for the sell-flow UI (brand, model, or variant). */
  results: FinCatalogSearchResultRow[]
  meta: { backend: "elasticsearch" | "supabase"; finBrandCount: number }
}

export type FinCatalogSearchResultRow =
  | FinCatalogSearchBrandRow
  | FinCatalogSearchModelRow
  | FinCatalogSearchVariantRow

export type FinCatalogSearchSelection =
  | {
      kind: "brand"
      brandId: string
      brandName: string
      suggestedTitle: string
      suggestedDescription: string | null
    }
  | {
      kind: "model"
      brandId: string
      brandName: string
      brandModelId: string
      modelName: string
      suggestedTitle: string
      suggestedDescription: string | null
    }
  | {
      kind: "variant"
      brandId: string
      brandName: string
      brandModelId: string
      modelName: string
      finSetup: string
      finSystem: string
      finSize: string | null
      suggestedTitle: string
      suggestedDescription: string | null
    }

function finCatalogListingDescriptionPrefill(raw: string | null | undefined): string | null {
  const t = raw?.trim() ?? ""
  return t.length > 0 ? t : null
}

function capFinCatalogTitle(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ")
  return t.length <= FIN_LISTING_TITLE_MAX_LENGTH
    ? t
    : t.slice(0, FIN_LISTING_TITLE_MAX_LENGTH).trimEnd()
}

/** Map a catalog search result row to sell-form prefill values (client-safe). */
export function finCatalogSelectionFromRow(
  row: FinCatalogSearchBrandRow | FinCatalogSearchModelRow | FinCatalogSearchVariantRow,
): FinCatalogSearchSelection {
  if (row.kind === "brand") {
    return {
      kind: "brand",
      brandId: row.id,
      brandName: row.name,
      suggestedTitle: capFinCatalogTitle(row.name),
      suggestedDescription: finCatalogListingDescriptionPrefill(row.shortDescription),
    }
  }
  if (row.kind === "model") {
    return {
      kind: "model",
      brandId: row.brandId,
      brandName: row.brandName,
      brandModelId: row.id,
      modelName: row.name,
      suggestedTitle: capFinCatalogTitle(`${row.brandName} ${row.name}`),
      suggestedDescription: finCatalogListingDescriptionPrefill(row.description),
    }
  }
  return {
    kind: "variant",
    brandId: row.brandId,
    brandName: row.brandName,
    brandModelId: row.brandModelId,
    modelName: row.modelName,
    finSetup: row.finSetup,
    finSystem: row.finSystem,
    finSize: row.finSize,
    suggestedTitle: row.suggestedTitle,
    suggestedDescription: finCatalogListingDescriptionPrefill(row.modelDescription),
  }
}
