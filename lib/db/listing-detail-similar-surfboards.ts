import type { SupabaseClient } from "@supabase/supabase-js"

/** Tight band first; widen if marketplace is sparse so the PDP still surfaces results. */
const PRICE_BANDS: readonly { minFactor: number; maxFactor: number }[] = [
  { minFactor: 0.72, maxFactor: 1.28 },
  { minFactor: 0.58, maxFactor: 1.42 },
  { minFactor: 0.45, maxFactor: 1.65 },
]

/** Shared PDP surfboard strip shape (tiles, favorites cart, category pill). */
export const PDP_PEER_SURFBOARD_STRIP_SELECT = `
  *,
  listing_images (url, thumbnail_url, sort_order, is_primary),
  categories (name)
`

export type SimilarSurfboardListingRow = Record<string, unknown>

/**
 * Active peer surfboards matching `board_type`, excluding the current listing, with price in a band around `priceUsd`.
 * Used for PDP “similar category + similar price” horizontal strips.
 */
export async function fetchSimilarSurfboardsForListingPdp(
  supabase: SupabaseClient,
  opts: {
    excludeListingId: string
    boardType: string | null | undefined
    priceUsd: number
    limit?: number
  },
): Promise<SimilarSurfboardListingRow[]> {
  const type = typeof opts.boardType === "string" ? opts.boardType.trim() : ""
  if (!type) return []

  const price =
    typeof opts.priceUsd === "number" && Number.isFinite(opts.priceUsd) && opts.priceUsd > 0
      ? opts.priceUsd
      : 0
  if (price <= 0) return []

  const limit = Math.min(Math.max(opts.limit ?? 16, 1), 24)

  for (const { minFactor, maxFactor } of PRICE_BANDS) {
    const low = Math.max(0, Math.floor(price * minFactor))
    const high = Math.ceil(price * maxFactor)

    const { data, error } = await supabase
      .from("listings")
      .select(PDP_PEER_SURFBOARD_STRIP_SELECT)
      .eq("section", "surfboards")
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .eq("board_type", type)
      .neq("id", opts.excludeListingId)
      .gte("price", low)
      .lte("price", high)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) continue
    if (data && data.length > 0) return data as SimilarSurfboardListingRow[]
  }

  return []
}

/**
 * Active surfboard listings with the highest `views`, excluding the current PDP.
 * Returns a pool for the PDP to further filter (e.g. omit “similar boards” duplicates).
 */
export async function fetchMostViewedSurfboardsPoolForListingPdp(
  supabase: SupabaseClient,
  opts: {
    excludeListingId: string
    /** Cap before client-side filtering; keep generous for duplicate removal. */
    limit?: number
  },
): Promise<SimilarSurfboardListingRow[]> {
  const fetchCap = Math.min(Math.max(opts.limit ?? 48, 8), 64)

  const { data, error } = await supabase
    .from("listings")
    .select(PDP_PEER_SURFBOARD_STRIP_SELECT)
    .eq("section", "surfboards")
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .neq("id", opts.excludeListingId)
    .order("views", { ascending: false, nullsFirst: false })
    .limit(fetchCap)

  if (error || !data?.length) return []
  return data as SimilarSurfboardListingRow[]
}
