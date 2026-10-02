import { cache } from "react"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { SURFBOARD_LISTING_SELECT } from "@/lib/listing-detail-cache-selects"
import { findListingByParam } from "@/lib/listing-query"

/**
 * Hidden listings and public-cache misses. Metadata and `ListingDetailDynamicGate`
 * both need this row; one React `cache()` so a single request hits the database once.
 * Do not call this on the anonymous public hit path — that path stays cookie-free.
 */
export const getCachedLiveListingByParam = cache(async (listingParam: string) => {
  const { supabase } = await getCachedRequestSession()
  return findListingByParam(supabase, listingParam, {
    select: SURFBOARD_LISTING_SELECT,
    section: undefined,
    includeHiddenListings: true,
  })
})
