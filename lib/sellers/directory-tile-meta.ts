import { toUsStateCode } from "@/lib/utils/us-state-code"

export type SellerListingForTileMeta = {
  city: string | null
  state: string | null
  shipping_available: boolean | null
}

export type SellerDirectoryTileMeta = {
  offersShipping: boolean
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

function formatLocatedIn(state: string | null | undefined): string | null {
  const s = normalizeSellerDirectoryState(state)
  if (s) return `Located in ${s}`
  return null
}

function resolvePrimaryListingState(listings: SellerListingForTileMeta[]): string | null {
  const stateCounts = new Map<string, number>()
  for (const listing of listings) {
    const state = normalizeSellerDirectoryState(listing.state)
    if (state) {
      stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1)
    }
  }

  let state: string | null = null
  let topCount = 0
  for (const [candidate, count] of stateCounts) {
    if (count > topCount) {
      topCount = count
      state = candidate
    }
  }

  if (state) return state

  const fallbackListing = listings.find((l) => l.state?.trim())
  return normalizeSellerDirectoryState(fallbackListing?.state)
}

function resolveLocatedInLabel(listings: SellerListingForTileMeta[]): string | null {
  return formatLocatedIn(resolvePrimaryListingState(listings))
}

/** Aggregate ship-from / located-in copy from listing rows (active and/or sold). */
export function deriveSellerDirectoryTileMeta(
  listings: SellerListingForTileMeta[],
): SellerDirectoryTileMeta {
  const offersShipping = listings.some((l) => l.shipping_available === true)

  if (offersShipping) {
    const state = resolvePrimaryListingState(listings)
    return {
      offersShipping: true,
      shipFromState: state,
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
