/**
 * The ordered result passes `/search` actually shows.
 * Saved-search alerts must use this same list: the first pass that has rows
 * is the page, and a listing is a match only when that pass returns it.
 */

import { ELASTICSEARCH_INDEXED_LISTING_SECTIONS } from "@/lib/elasticsearch/listing-sections"
import type { MarketplaceParsedQuery } from "@/lib/services/marketplaceQueryParse"
import { brandLegacyRecallTokens } from "@/lib/utils/marketplace-brand-query"

export type MarketplaceSearchEsPass = {
  q: string
  brandModelIds: string[] | null
  brandId: string | null
  lengthInches: number | null
  boardTypes: string[] | null
  sections: string[]
  typoFallback: boolean
}

export type MarketplaceSearchPlan = {
  expansions: string[]
  /** Brand inventory is the page when this is true and it has rows. */
  useBrandInventory: boolean
  /** Empty inventory with no typed query stays empty. The page does not relax. */
  inventoryIsFinal: boolean
  inventorySections: string[] | undefined
  categoryId: string | null
  brand: { id: string; name: string } | null
  brandModelIds: string[]
  boardTypes: string[] | null
  sections: string[]
  esPasses: MarketplaceSearchEsPass[]
}

function indexedSections(): string[] {
  return [...ELASTICSEARCH_INDEXED_LISTING_SECTIONS]
}

/**
 * Build the same pass order as `resolveSearchListings` on `/search`.
 * `fallbackExpansions` is used only when the query was not parsed (short text).
 */
export function buildMarketplaceSearchPlan(input: {
  rawQuery: string
  parsed: MarketplaceParsedQuery | null
  brand: { id: string; name: string } | null
  brandFromUrl: boolean
  categoryId: string | null
  fallbackExpansions?: string[]
}): MarketplaceSearchPlan {
  const raw = input.rawQuery.trim()
  const parsed = input.parsed
  const brand = input.brand
  const expansions = [
    ...(parsed?.expansions ?? input.fallbackExpansions ?? []),
    ...(brand ? brandLegacyRecallTokens(brand.name) : []),
  ]
  const widenBrandWithAliases = Boolean(
    parsed?.isBrandOnly && expansions.length > 0 && (parsed.brand?.id || brand?.id),
  )
  const textQuery = widenBrandWithAliases
    ? ""
    : parsed != null
      ? (parsed.textQuery ?? "").trim()
      : raw
  const brandModelIds =
    parsed?.modelIds?.length
      ? parsed.modelIds
      : parsed?.model?.id
        ? [parsed.model.id]
        : []
  const brandId =
    brandModelIds.length > 0
      ? null
      : parsed?.brand?.id ?? (input.brandFromUrl ? brand?.id ?? null : null) ?? null
  const lengthInches = parsed?.lengthInches ?? null
  const boardTypes = parsed?.styleIntent?.length ? parsed.styleIntent : null
  const sections = input.categoryId
    ? ["surfboards"]
    : parsed?.sectionIntent
      ? [parsed.sectionIntent]
      : indexedSections()

  const esPasses: MarketplaceSearchEsPass[] = [
    {
      q: textQuery,
      brandModelIds: brandModelIds.length > 0 ? brandModelIds : null,
      brandId,
      lengthInches,
      boardTypes,
      sections,
      typoFallback: false,
    },
  ]

  if (lengthInches != null && brandModelIds.length > 0) {
    esPasses.push({
      q: textQuery,
      brandModelIds,
      brandId: null,
      lengthInches: null,
      boardTypes,
      sections,
      typoFallback: false,
    })
  }

  if (brandModelIds.length > 0) {
    esPasses.push({
      q: raw,
      brandModelIds: null,
      brandId: parsed?.brand?.id ?? brandId,
      lengthInches: null,
      boardTypes,
      sections,
      typoFallback: false,
    })
  }

  esPasses.push({
    q: raw,
    brandModelIds: null,
    brandId: null,
    lengthInches: null,
    boardTypes,
    sections,
    typoFallback: false,
  })

  esPasses.push({
    q: textQuery || raw,
    brandModelIds: null,
    brandId: null,
    lengthInches: null,
    boardTypes,
    sections,
    typoFallback: true,
  })

  if (parsed?.sectionIntent || (boardTypes?.length ?? 0) > 0) {
    esPasses.push({
      q: raw,
      brandModelIds: null,
      brandId: null,
      lengthInches: null,
      boardTypes: null,
      sections: indexedSections(),
      typoFallback: false,
    })
  }

  return {
    expansions,
    useBrandInventory:
      Boolean(brand) &&
      ((!raw && input.brandFromUrl) || Boolean(parsed?.isBrandOnly)) &&
      (parsed?.expansions.length ?? 0) === 0,
    inventoryIsFinal: raw.length === 0,
    inventorySections: parsed?.sectionIntent ? [parsed.sectionIntent] : undefined,
    categoryId: input.categoryId,
    brand,
    brandModelIds,
    boardTypes,
    sections,
    esPasses,
  }
}
