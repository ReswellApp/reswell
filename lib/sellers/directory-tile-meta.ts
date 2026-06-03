export type SellerListingForTileMeta = {
  state: string | null
  shipping_available: boolean | null
  board_shipping_cost_mode: "reswell" | "flat" | "free" | null
  shipping_price: number | string | null
}

export type SellerDirectoryTileMeta = {
  shipFromState: string | null
  shippingLine: string | null
}

function parseShippingPrice(raw: number | string | null | undefined): number {
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""))
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

/** Aggregate ship-from and free-shipping copy from a seller's active listings. */
export function deriveSellerDirectoryTileMeta(
  listings: SellerListingForTileMeta[],
): SellerDirectoryTileMeta {
  if (listings.length === 0) {
    return { shipFromState: null, shippingLine: null }
  }

  const stateCounts = new Map<string, number>()
  for (const listing of listings) {
    const state = listing.state?.trim().toUpperCase()
    if (state && state.length >= 2) {
      stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1)
    }
  }

  let shipFromState: string | null = null
  let topCount = 0
  for (const [state, count] of stateCounts) {
    if (count > topCount) {
      topCount = count
      shipFromState = state
    }
  }
  if (!shipFromState) {
    const fallback = listings.find((l) => l.state?.trim())?.state?.trim()
    shipFromState = fallback ? fallback.toUpperCase() : null
  }

  const shippable = listings.filter((l) => l.shipping_available === true)
  let shippingLine: string | null = null
  if (shippable.some((l) => l.board_shipping_cost_mode === "free")) {
    shippingLine = "Free shipping"
  } else if (
    shippable.some(
      (l) => l.board_shipping_cost_mode !== "flat" && parseShippingPrice(l.shipping_price) === 0,
    )
  ) {
    shippingLine = "Free shipping"
  }

  return { shipFromState, shippingLine }
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
