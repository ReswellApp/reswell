import type { User } from "@supabase/supabase-js"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { findListingByParam } from "@/lib/listing-query"
import {
  getCachedPublicSurfboardListing,
  SURFBOARD_LISTING_SELECT,
} from "@/lib/listing-detail-cache"

export type ListingDetailPageSharedProps = {
  listingParam: string
  prefetchedListing?: Record<string, unknown> | null
  viewerUser?: User | null
}

type LoadListingDetailPageContextOptions = ListingDetailPageSharedProps & {
  section?: string
  /** Surfboards PDP: fall back to hourly public cache before live RLS fetch. */
  usePublicCache?: boolean
}

export async function loadListingDetailPageContext({
  listingParam,
  prefetchedListing,
  viewerUser,
  section,
  usePublicCache = false,
}: LoadListingDetailPageContextOptions) {
  const { supabase, user: sessionUser } = await getCachedRequestSession()
  const user = viewerUser !== undefined ? viewerUser : sessionUser

  let listing = prefetchedListing ?? null
  if (!listing) {
    if (usePublicCache) {
      const cached = await getCachedPublicSurfboardListing(listingParam)
      listing = (cached.listing as Record<string, unknown> | null) ?? null
    }
    if (!listing) {
      const r = await findListingByParam(supabase, listingParam, {
        select: SURFBOARD_LISTING_SELECT,
        section,
        includeHiddenListings: true,
      })
      listing = (r.listing as Record<string, unknown> | null) ?? null
    }
  }

  return { supabase, user, listing }
}
