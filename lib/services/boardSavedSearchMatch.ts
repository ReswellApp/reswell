/**
 * Saved-search matching across peer marketplace sections.
 *
 * Surfboards: replay `/boards` Elasticsearch browse with `restrictToIds`.
 * Other sections: field-match against the listing row (browse is Supabase today).
 * Alerts are nationwide — geo/location criteria are never applied here.
 */

import {
  EMPTY_FACET_SELECTIONS,
  type BoardsBrowseFacetSelections,
} from "@/lib/boards-browse-facets"
import { isBoardsBrowseEsEnabled } from "@/lib/db/boards-browse-listings-es"
import { searchBoardsBrowse } from "@/lib/elasticsearch/boards-browse-search"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import {
  boardTypeForDbFromBrowseParam,
  BOARDS_BROWSE_DEFAULT_SORT,
} from "@/lib/marketplace-slug-metadata"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  boardSavedSearchCriteriaSchema,
  type BoardSavedSearchCriteria,
} from "@/lib/validations/boardSavedSearch"
import {
  boardDimensionBrowseFieldsFromSearchParams,
  boardDimensionBrowseIlikeTokens,
} from "@/lib/utils/board-dimension-browse-filter"
import { resolveSavedSearchSection } from "@/lib/utils/peer-saved-search-criteria"

export type ListingRowForBoardAlert = {
  id: string
  user_id: string
  section: string | null
  status: string | null
  hidden_from_site?: boolean | null
  title: string | null
  description?: string | null
  price: number | string | null
  brand?: string | null
  model?: string | null
  dimensions?: string | null
  board_type?: string | null
  condition?: string | null
  brand_id?: string | null
  brand_model_id?: string | null
  slug?: string | null
  fins_setup?: string | null
  fin_system?: string | null
  fin_size?: string | null
  wetsuit_size?: string | null
  apparel_kind?: string | null
  magazine_year?: number | string | null
}

function parseCommaSlugs(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(",")) {
    const slug = part.trim()
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    out.push(slug)
  }
  return out
}

/** Map stored saved-search criteria → browse facet selections. */
export function boardSavedCriteriaToFacetSelections(
  c: BoardSavedSearchCriteria,
): BoardsBrowseFacetSelections {
  const styles =
    c.style && c.style.length > 0
      ? c.style
      : c.type && c.type !== "all"
        ? [c.type]
        : []
  const conditions =
    c.conditions && c.conditions.length > 0
      ? c.conditions
      : parseCommaSlugs(c.condition).filter((s) => s !== "all")

  return {
    styles,
    conditions,
    finSetups: c.fin ?? [],
    finSystems: c.finSystem ?? [],
    constructions: c.construction ?? [],
    lengthBuckets: c.length ?? [],
    volumeBuckets: c.volume ?? [],
  }
}

/**
 * Convert saved criteria into `/boards` Elasticsearch search params.
 * Intentionally omits geo — email alerts match nationwide.
 */
export function boardSavedCriteriaToBrowseEsParams(c: BoardSavedSearchCriteria) {
  const facets = boardSavedCriteriaToFacetSelections(c)
  const hasFacetStyles = facets.styles.length > 0
  const hasFacetConditions = facets.conditions.length > 0

  const dimFields = boardDimensionBrowseFieldsFromSearchParams({
    dimLength: c.dimLength,
    dimWidth: c.dimWidth,
    dimThickness: c.dimThickness,
    dimVolume: c.dimVolume,
    legacyDimensions:
      c.dimLength || c.dimWidth || c.dimThickness || c.dimVolume
        ? undefined
        : c.dimensions,
  })
  const dimensionTokens = boardDimensionBrowseIlikeTokens(dimFields)

  const hasAnyFacet =
    facets.styles.length > 0 ||
    facets.conditions.length > 0 ||
    facets.finSetups.length > 0 ||
    facets.finSystems.length > 0 ||
    facets.constructions.length > 0 ||
    facets.lengthBuckets.length > 0 ||
    facets.volumeBuckets.length > 0

  return {
    query: c.q?.trim() || undefined,
    brand: c.brand?.trim() || undefined,
    brandId: c.brandId?.trim() || undefined,
    model: c.model?.trim() || undefined,
    brandModelId: c.brandModelId?.trim() || undefined,
    minPrice: c.minPrice,
    maxPrice: c.maxPrice,
    boardType: hasFacetStyles ? undefined : c.type,
    condition: hasFacetConditions ? undefined : c.condition,
    facets: hasAnyFacet ? facets : EMPTY_FACET_SELECTIONS,
    dimensionTokens: dimensionTokens.length > 0 ? dimensionTokens : undefined,
    shippingAvailable: c.shipping === true ? true : undefined,
    sort: c.sort?.trim() || BOARDS_BROWSE_DEFAULT_SORT,
  }
}

/**
 * Ensure the listing is searchable in ES before replaying saved searches.
 * Uses `refresh: wait_for` so the subsequent match query can see the doc.
 */
export async function ensureListingIndexedForSavedSearchAlerts(
  listingId: string,
): Promise<void> {
  if (!isBoardsBrowseEsEnabled()) return
  try {
    const service = createServiceRoleClient()
    await syncListingToIndex(service, listingId, { refresh: "wait_for" })
  } catch (err) {
    console.error("[board_saved_search] ensure index for alerts failed:", err)
  }
}

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase()
}

function includesInsensitive(
  haystack: string | null | undefined,
  needle: string | undefined,
): boolean {
  const n = (needle ?? "").trim()
  if (!n) return true
  return norm(haystack).includes(n.toLowerCase())
}

function keywordMatchesListing(listing: ListingRowForBoardAlert, q: string | undefined): boolean {
  const needle = (q ?? "").trim()
  if (!needle) return true
  const n = needle.toLowerCase()
  const blob = [
    listing.title,
    listing.description,
    listing.brand,
    listing.model,
    listing.dimensions,
    listing.fins_setup,
    listing.fin_system,
    listing.fin_size,
    listing.wetsuit_size,
  ]
    .map((x) => norm(x))
    .join(" ")
  return blob.includes(n)
}

function boardTypeMatches(
  criteriaType: string | undefined,
  listingBoardType: string | null | undefined,
): boolean {
  if (!criteriaType || criteriaType === "all") return true
  const expected = boardTypeForDbFromBrowseParam(criteriaType)
  if (!expected) return true
  return (listingBoardType ?? "").trim() === expected
}

function conditionMatches(
  criteriaCondition: string | undefined,
  conditions: string[] | undefined,
  listingCondition: string | null | undefined,
): boolean {
  const allowed =
    conditions && conditions.length > 0
      ? conditions
      : parseCommaSlugs(criteriaCondition).filter((s) => s !== "all")
  if (allowed.length === 0) return true
  const actual = (listingCondition ?? "").trim()
  return allowed.includes(actual)
}

function priceMatches(
  listingPrice: number | string | null | undefined,
  minPrice: number | undefined,
  maxPrice: number | undefined,
): boolean {
  const p = typeof listingPrice === "number" ? listingPrice : Number(listingPrice ?? NaN)
  if (!Number.isFinite(p)) return false
  if (minPrice != null && !Number.isNaN(minPrice) && p < minPrice) return false
  if (maxPrice != null && !Number.isNaN(maxPrice) && p > maxPrice) return false
  return true
}

function slugListOverlapsStored(
  wanted: string[] | undefined,
  stored: string | null | undefined,
): boolean {
  if (!wanted || wanted.length === 0) return true
  const tokens = parseCommaSlugs(stored ?? undefined)
  if (tokens.length === 0) {
    const single = (stored ?? "").trim()
    if (!single) return false
    return wanted.includes(single)
  }
  return wanted.some((w) => tokens.includes(w))
}

function yearMatches(
  listingYear: number | string | null | undefined,
  minYear: number | undefined,
  maxYear: number | undefined,
): boolean {
  if (minYear == null && maxYear == null) return true
  const y = typeof listingYear === "number" ? listingYear : Number(listingYear ?? NaN)
  if (!Number.isFinite(y)) return false
  if (minYear != null && y < minYear) return false
  if (maxYear != null && y > maxYear) return false
  return true
}

function sectionAllowsListing(
  criteria: BoardSavedSearchCriteria,
  listingSection: string | null | undefined,
): boolean {
  const target = resolveSavedSearchSection(criteria)
  if (target === "any") return isPeerListingSection(listingSection)
  return listingSection === target
}

/**
 * In-process field matcher (non-surfboard sections, or ES fallback).
 */
export function listingMatchesBoardSavedCriteria(
  listing: ListingRowForBoardAlert,
  rawCriteria: unknown,
): boolean {
  const parsed = boardSavedSearchCriteriaSchema.safeParse(rawCriteria)
  if (!parsed.success) return false
  const c = parsed.data

  if (!sectionAllowsListing(c, listing.section)) return false
  if (listing.status !== "active") return false
  if (listing.hidden_from_site) return false

  if (!keywordMatchesListing(listing, c.q)) return false

  if (c.brandModelId?.trim()) {
    if ((listing.brand_model_id ?? "").trim() !== c.brandModelId.trim()) return false
  } else if (c.brandId?.trim()) {
    if ((listing.brand_id ?? "").trim() !== c.brandId.trim()) return false
  } else {
    if (!includesInsensitive(listing.brand, c.brand)) return false
    const modelOk =
      !c.model?.trim() ||
      includesInsensitive(listing.model, c.model) ||
      includesInsensitive(listing.title, c.model)
    if (!modelOk) return false
  }

  if (!conditionMatches(c.condition, c.conditions, listing.condition)) return false
  if (!priceMatches(listing.price, c.minPrice, c.maxPrice)) return false

  const section = resolveSavedSearchSection(c)
  const isSurfboards = section === "surfboards" || (section === "any" && listing.section === "surfboards")

  if (isSurfboards || listing.section === "surfboards") {
    const hasStructuredDims =
      Boolean(c.dimLength?.trim()) ||
      Boolean(c.dimWidth?.trim()) ||
      Boolean(c.dimThickness?.trim()) ||
      Boolean(c.dimVolume?.trim())
    const dimFields = boardDimensionBrowseFieldsFromSearchParams({
      dimLength: c.dimLength,
      dimWidth: c.dimWidth,
      dimThickness: c.dimThickness,
      dimVolume: c.dimVolume,
      legacyDimensions: hasStructuredDims ? undefined : c.dimensions,
    })
    const dimTokens = boardDimensionBrowseIlikeTokens(dimFields)
    for (const token of dimTokens) {
      if (!includesInsensitive(listing.dimensions, token)) return false
    }

    const styles = c.style && c.style.length > 0 ? c.style : null
    if (styles) {
      const expected = styles
        .map((s) => boardTypeForDbFromBrowseParam(s))
        .filter((s): s is string => Boolean(s))
      if (expected.length > 0 && !expected.includes((listing.board_type ?? "").trim())) {
        return false
      }
    } else if (!boardTypeMatches(c.type, listing.board_type)) {
      return false
    }
  }

  if (listing.section === "fins" || (section === "fins" && !c.anySection)) {
    if (!slugListOverlapsStored(c.fin, listing.fins_setup)) return false
    if (!slugListOverlapsStored(c.finSystem, listing.fin_system)) return false
    if (!slugListOverlapsStored(c.sizes, listing.fin_size)) return false
  }

  if (listing.section === "wetsuits" || (section === "wetsuits" && !c.anySection)) {
    if (!slugListOverlapsStored(c.sizes, listing.wetsuit_size)) return false
  }

  if (listing.section === "apparel" || (section === "apparel" && !c.anySection)) {
    if (!slugListOverlapsStored(c.kind, listing.apparel_kind)) return false
  }

  if (listing.section === "magazines" || (section === "magazines" && !c.anySection)) {
    if (!yearMatches(listing.magazine_year, c.minYear, c.maxYear)) return false
  }

  return true
}

/**
 * True when the listing would appear in the saved search.
 * Surfboards prefer Elasticsearch browse replay; other sections use field matching.
 */
export async function listingMatchesSavedSearch(
  listingId: string,
  listing: ListingRowForBoardAlert,
  rawCriteria: unknown,
): Promise<boolean> {
  const parsed = boardSavedSearchCriteriaSchema.safeParse(rawCriteria)
  if (!parsed.success) return false

  if (!sectionAllowsListing(parsed.data, listing.section)) return false

  const target = resolveSavedSearchSection(parsed.data)
  const useBoardsEs =
    (target === "surfboards" || (target === "any" && listing.section === "surfboards")) &&
    isBoardsBrowseEsEnabled()

  if (useBoardsEs) {
    try {
      const esParams = boardSavedCriteriaToBrowseEsParams(parsed.data)
      const res = await searchBoardsBrowse({
        ...esParams,
        restrictToIds: [listingId],
        from: 0,
        size: 1,
        sort: "newest",
      })
      if (res !== null) {
        return res.total > 0 || res.ids.includes(listingId)
      }
    } catch (err) {
      console.error("[board_saved_search] ES match failed, using fallback:", err)
    }
  }

  return listingMatchesBoardSavedCriteria(listing, rawCriteria)
}
