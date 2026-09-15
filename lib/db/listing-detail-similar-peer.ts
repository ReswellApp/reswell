import type { SupabaseClient } from "@supabase/supabase-js"
import { HOME_PEER_LISTING_WITH_PROFILE_SELECT } from "@/lib/db/home-peer-listing-feed"
import {
  isPeerSimilarFacetColumn,
  isPeerSimilarSection,
  normalizePeerSimilarFacetValue,
  peerSimilarPriceRange,
  peerSimilarPriceUsd,
  PEER_SIMILAR_PRICE_BANDS,
  type PeerSimilarFacetColumn,
  type PeerSimilarSection,
} from "@/lib/utils/listing-detail-similar-peer"

export type SimilarPeerListingRow = Record<string, unknown>

/**
 * Active peer listings in the same section, excluding the current listing, with
 * price in a band around `priceUsd`. Optional facet (size/system/kind/year)
 * is tried first; if the marketplace is sparse we fall back to section + price,
 * then recent same-section inventory.
 */
export async function fetchSimilarPeerListingsForListingPdp(
  supabase: SupabaseClient,
  opts: {
    excludeListingId: string
    section: string
    priceUsd: number
    facet?: { column: PeerSimilarFacetColumn; value: string | number | null | undefined }
    limit?: number
  },
): Promise<SimilarPeerListingRow[]> {
  if (!isPeerSimilarSection(opts.section)) return []

  const limit = Math.min(Math.max(opts.limit ?? 16, 1), 24)
  const price = peerSimilarPriceUsd(opts.priceUsd)
  const facetColumn =
    opts.facet && isPeerSimilarFacetColumn(opts.facet.column) ? opts.facet.column : null
  const facetValue = facetColumn ? normalizePeerSimilarFacetValue(opts.facet?.value) : null

  try {
    if (price > 0 && facetColumn && facetValue != null) {
      const withFacet = await fetchPeerSimilarInPriceBands(supabase, {
        section: opts.section,
        excludeListingId: opts.excludeListingId,
        limit,
        price,
        facetColumn,
        facetValue,
      })
      if (withFacet.length > 0) return withFacet
    }

    if (price > 0) {
      const byPrice = await fetchPeerSimilarInPriceBands(supabase, {
        section: opts.section,
        excludeListingId: opts.excludeListingId,
        limit,
        price,
      })
      if (byPrice.length > 0) return byPrice
    }

    const { data, error } = await supabase
      .from("listings")
      .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
      .eq("section", opts.section)
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .neq("id", opts.excludeListingId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data as SimilarPeerListingRow[]
  } catch {
    return []
  }
}

async function fetchPeerSimilarInPriceBands(
  supabase: SupabaseClient,
  opts: {
    section: PeerSimilarSection
    excludeListingId: string
    limit: number
    price: number
    facetColumn?: PeerSimilarFacetColumn
    facetValue?: string | number
  },
): Promise<SimilarPeerListingRow[]> {
  for (const band of PEER_SIMILAR_PRICE_BANDS) {
    const { low, high } = peerSimilarPriceRange(opts.price, band)
    let query = supabase
      .from("listings")
      .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
      .eq("section", opts.section)
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .neq("id", opts.excludeListingId)
      .gte("price", low)
      .lte("price", high)
      .order("created_at", { ascending: false })
      .limit(opts.limit)

    if (opts.facetColumn && opts.facetValue != null) {
      query = query.eq(opts.facetColumn, opts.facetValue)
    }

    const { data, error } = await query
    if (error) continue
    if (data && data.length > 0) return data as SimilarPeerListingRow[]
  }

  return []
}
