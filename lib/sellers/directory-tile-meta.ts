import { toUsStateCode } from "@/lib/utils/us-state-code"

export type SellerListingForTileMeta = {
  city: string | null
  state: string | null
  shipping_available: boolean | null
}

export type SellerDirectoryTileMeta = {
  offersShipping: boolean
  /** Location fragment after "Ships from" (e.g. "San Diego, CA" or "CA"). */
  shipFromState: string | null
  shippingLine: string | null
  locatedInLabel: string | null
}

/**
 * Collapse full state names and abbreviations to one USPS code (California / CALIFORNIA / CA → CA).
 * Returns null when the value is not a recognized US state or territory code.
 */
function normalizeSellerDirectoryState(raw: string | null | undefined): string | null {
  const trimmed = typeof raw === "string" ? raw.trim() : ""
  if (!trimmed) return null
  return toUsStateCode(trimmed) ?? null
}

function trimCity(raw: string | null | undefined): string | null {
  const trimmed = typeof raw === "string" ? raw.trim() : ""
  return trimmed.length > 0 ? trimmed : null
}

/** "San Diego, CA" when both exist; otherwise whichever part is available. */
function formatLocationCityState(city: string | null, state: string | null): string | null {
  const normalizedState = normalizeSellerDirectoryState(state)
  const normalizedCity = trimCity(city)
  if (normalizedCity && normalizedState) return `${normalizedCity}, ${normalizedState}`
  if (normalizedState) return normalizedState
  if (normalizedCity) return normalizedCity
  return null
}

function formatLocatedIn(city: string | null, state: string | null): string | null {
  const location = formatLocationCityState(city, state)
  if (location) return `Located in ${location}`
  return null
}

type ListingLocationPair = {
  city: string | null
  state: string | null
}

function listingLocationPair(listing: SellerListingForTileMeta): ListingLocationPair | null {
  const city = trimCity(listing.city)
  const state = normalizeSellerDirectoryState(listing.state)
  if (!city && !state) return null
  return { city, state }
}

function locationPairKey(pair: ListingLocationPair): string {
  return `${pair.city ?? ""}|${pair.state ?? ""}`
}

/** Most common city/state among listings; ties favor the first seen pair. */
function resolvePrimaryListingLocation(listings: SellerListingForTileMeta[]): ListingLocationPair | null {
  const pairCounts = new Map<string, { pair: ListingLocationPair; count: number }>()

  for (const listing of listings) {
    const pair = listingLocationPair(listing)
    if (!pair) continue
    const key = locationPairKey(pair)
    const existing = pairCounts.get(key)
    if (existing) existing.count += 1
    else pairCounts.set(key, { pair, count: 1 })
  }

  let best: { pair: ListingLocationPair; count: number } | null = null
  for (const entry of pairCounts.values()) {
    if (!best || entry.count > best.count) best = entry
  }
  if (best) return best.pair

  const fallbackListing = listings.find((l) => l.city?.trim() || l.state?.trim())
  return fallbackListing ? listingLocationPair(fallbackListing) : null
}

function resolvePrimaryListingState(listings: SellerListingForTileMeta[]): string | null {
  const pair = resolvePrimaryListingLocation(listings)
  if (!pair) return null
  return formatLocationCityState(pair.city, pair.state)
}

function resolveLocatedInLabel(listings: SellerListingForTileMeta[]): string | null {
  const pair = resolvePrimaryListingLocation(listings)
  if (!pair) return null
  return formatLocatedIn(pair.city, pair.state)
}

/** Aggregate ship-from / located-in copy from listing rows (active and/or sold). */
export function deriveSellerDirectoryTileMeta(
  listings: SellerListingForTileMeta[],
): SellerDirectoryTileMeta {
  const offersShipping = listings.some((l) => l.shipping_available === true)

  if (offersShipping) {
    const shipFrom = resolvePrimaryListingState(listings)
    return {
      offersShipping: true,
      shipFromState: shipFrom,
      shippingLine: "Seller offers shipping",
      locatedInLabel: null,
    }
  }

  return {
    offersShipping: false,
    shipFromState: null,
    shippingLine: null,
    locatedInLabel: resolveLocatedInLabel(listings),
  }
}

export type SellerReviewSummary = {
  avgRating: number
  reviewCount: number
}

/** Average rating + count from raw review rows. */
export function summarizeSellerReviews(
  rows: { rating: number }[] | null | undefined,
): SellerReviewSummary {
  const list = rows ?? []
  if (list.length === 0) return { avgRating: 0, reviewCount: 0 }
  const total = list.reduce((sum, row) => sum + row.rating, 0)
  return { avgRating: total / list.length, reviewCount: list.length }
}
