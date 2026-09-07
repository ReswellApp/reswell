import {
  facetSelectionsFromBrowseParams,
  type BoardsBrowseFacetSelections,
} from "@/lib/boards-browse-facets"
import type { FacetCountRow } from "@/lib/db/boards-browse-facet-counts"
import { isBoardsBrowseShippingAvailableParam } from "@/lib/marketplace-slug-metadata"
import {
  computeBoardsBrowseFacetCounts,
  facetCountsByParamKey,
  rowMatchesBrowseFacets,
} from "@/lib/services/boardsBrowseFacetCounts"
import type { CityLandingListing } from "@/lib/types/city-landing"

export function cityListingToFacetRow(listing: CityLandingListing): FacetCountRow {
  return {
    board_type: listing.board_type ?? null,
    condition: listing.condition ?? null,
    fins_setup: listing.fins_setup ?? null,
    fin_system: listing.fin_system ?? null,
    construction: listing.construction ?? null,
    length_total_inches: listing.length_total_inches ?? null,
    volume_liters: listing.volume_liters ?? null,
    dimensions: listing.dimensions ?? null,
    title: listing.title,
  }
}

export function browseSelectionsFromSearchParams(
  searchParams: URLSearchParams,
): BoardsBrowseFacetSelections {
  return facetSelectionsFromBrowseParams({
    type: searchParams.get("type"),
    style: searchParams.get("style") ?? undefined,
    condition: searchParams.get("condition") ?? undefined,
    fin: searchParams.get("fin") ?? undefined,
    finSystem: searchParams.get("finSystem") ?? undefined,
    construction: searchParams.get("construction") ?? undefined,
    length: searchParams.get("length") ?? undefined,
    volume: searchParams.get("volume") ?? undefined,
  })
}

function matchesBrandModel(listing: CityLandingListing, searchParams: URLSearchParams): boolean {
  const brand = searchParams.get("brand")?.trim().toLowerCase()
  const model = searchParams.get("model")?.trim().toLowerCase()
  if (brand && !(listing.brand ?? "").toLowerCase().includes(brand)) return false
  if (model && !(listing.model ?? "").toLowerCase().includes(model) && !listing.title.toLowerCase().includes(model)) {
    return false
  }
  return true
}

function matchesPrice(listing: CityLandingListing, searchParams: URLSearchParams): boolean {
  const minRaw = searchParams.get("minPrice")
  const maxRaw = searchParams.get("maxPrice")
  const min = minRaw ? Number(minRaw) : null
  const max = maxRaw ? Number(maxRaw) : null
  const price = Number(listing.price)
  if (min != null && Number.isFinite(min) && price < min) return false
  if (max != null && Number.isFinite(max) && price > max) return false
  return true
}

export function filterCityListingsByBrowseParams(
  listings: CityLandingListing[],
  searchParams: URLSearchParams,
): CityLandingListing[] {
  const selections = browseSelectionsFromSearchParams(searchParams)
  const shippingOnly = isBoardsBrowseShippingAvailableParam(
    searchParams.get("shipping") ?? undefined,
  )

  return listings.filter((listing) => {
    if (!rowMatchesBrowseFacets(cityListingToFacetRow(listing), selections)) return false
    if (!matchesBrandModel(listing, searchParams)) return false
    if (!matchesPrice(listing, searchParams)) return false
    if (shippingOnly && listing.shipping_available !== true) return false
    return true
  })
}

export function cityLandingFacetCounts(
  listings: CityLandingListing[],
  searchParams: URLSearchParams,
): Record<string, Record<string, number>> {
  const selections = browseSelectionsFromSearchParams(searchParams)
  const rows = listings
    .filter((listing) => matchesBrandModel(listing, searchParams) && matchesPrice(listing, searchParams))
    .filter((listing) => {
      const shippingOnly = isBoardsBrowseShippingAvailableParam(
        searchParams.get("shipping") ?? undefined,
      )
      return !shippingOnly || listing.shipping_available === true
    })
    .map(cityListingToFacetRow)
  return facetCountsByParamKey(computeBoardsBrowseFacetCounts(rows, selections))
}
