import type { SupabaseClient } from "@supabase/supabase-js"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { fetchAcceptedOfferForBuyerListing } from "@/lib/db/offers"
import { buyerAgreedPriceUsdFromOffer } from "@/lib/services/buyerAgreedPrice"

export type SurfboardListingViewerState = {
  isFavorited: boolean
  buyerAgreedPriceUsd: number | null
}

const EMPTY_VIEWER_STATE: SurfboardListingViewerState = {
  isFavorited: false,
  buyerAgreedPriceUsd: null,
}

/**
 * Signed-in favorite heart and accepted-offer price. The anonymous PDP never
 * calls this — `anonymousPublicView` leaves `user` null so the HTML stays cacheable.
 */
export async function loadSurfboardListingViewerState(
  listingId: string,
  sellerId: string,
  status: string,
): Promise<SurfboardListingViewerState> {
  try {
    const { supabase, user } = await getCachedRequestSession()
    if (!user) return EMPTY_VIEWER_STATE
    return await readSurfboardListingViewerState(supabase, user.id, listingId, sellerId, status)
  } catch (error) {
    console.error("[surfboard-pdp] viewer personalization failed", error)
    return EMPTY_VIEWER_STATE
  }
}

async function readSurfboardListingViewerState(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
  sellerId: string,
  status: string,
): Promise<SurfboardListingViewerState> {
  const isOwnListing = userId === sellerId
  const [favoriteRowsRes, acceptedOffer] = await Promise.all([
    supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", userId)
      .eq("listing_id", listingId),
    !isOwnListing && status === "active"
      ? fetchAcceptedOfferForBuyerListing(supabase, userId, listingId)
      : Promise.resolve(null),
  ])

  const favoriteRows = favoriteRowsRes.data
  const isFavorited =
    Array.isArray(favoriteRows) &&
    favoriteRows.some((row) => {
      if (!row || typeof row !== "object") return false
      return "listing_id" in row && row.listing_id === listingId
    })

  return {
    isFavorited,
    buyerAgreedPriceUsd: buyerAgreedPriceUsdFromOffer(acceptedOffer, sellerId),
  }
}
