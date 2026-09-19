import type { MarketplaceParsedQuery } from "@/lib/services/marketplaceQueryParse"
import { isReservedModelPageBrandSegment, modelPageHref, modelPageSlug } from "@/lib/models/routes"

export type MarketplaceModelPageRedirectInput = Pick<
  MarketplaceParsedQuery,
  | "raw"
  | "cleaned"
  | "brand"
  | "model"
  | "lengthInches"
  | "residualText"
  | "sectionIntent"
  | "styleIntent"
>

/**
 * When marketplace search is a clean catalog-model lookup, send shoppers to
 * `/[brand]/[model]` instead of listing results.
 *
 * Stay on `/search` when the query still has listing-style filters (length,
 * leftover keywords, section, or board style) or when the typed text is only
 * a prefix of the catalog name ("dumpster" → Dumpster Diver).
 */
export function marketplaceModelPageHrefFromParsed(
  parsed: MarketplaceModelPageRedirectInput | null | undefined,
): string | null {
  if (!parsed?.model || !parsed.brand?.slug) return null
  const brandSlug = parsed.brand.slug.trim()
  if (!brandSlug || isReservedModelPageBrandSegment(brandSlug)) return null
  if (parsed.lengthInches != null) return null
  if (parsed.residualText.trim()) return null
  if (parsed.sectionIntent) return null
  if (parsed.styleIntent.length > 0) return null

  const modelName = parsed.model.name.trim().toLowerCase()
  if (!modelName) return null
  const typed = `${parsed.raw} ${parsed.cleaned}`.toLowerCase()
  if (!typed.includes(modelName)) return null

  return modelPageHref(brandSlug, modelPageSlug(parsed.model.name))
}
