import type { SupabaseClient, User } from "@supabase/supabase-js"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { listingIdsWithOpenMarketplaceCheckout } from "@/lib/db/listingDeleteEligibility"
import { listingEligibleForSellerRelist } from "@/lib/listing-sold-state"
import { findListingByParam } from "@/lib/listing-query"
import {
  getCachedPublicSurfboardListing,
  SURFBOARD_LISTING_SELECT,
} from "@/lib/listing-detail-cache"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

export type ListingDetailPageSharedProps = {
  listingParam: string
  prefetchedListing?: Record<string, unknown> | null
  viewerUser?: User | null
  /** Hourly cached public PDP — skip cookie-bound Supabase session probe. */
  anonymousPublicView?: boolean
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
  anonymousPublicView = false,
}: LoadListingDetailPageContextOptions) {
  const { supabase, user: sessionUser } = await getCachedRequestSession()
  const user = viewerUser ?? sessionUser

  if (anonymousPublicView && prefetchedListing && !user) {
    return {
      supabase: createAnonSupabaseClient(),
      user: null as User | null,
      listing: prefetchedListing,
      canSellerRelist: false,
    }
  }

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

  return {
    supabase,
    user,
    listing,
    canSellerRelist: await resolveCanSellerRelist(supabase, user, listing),
  }
}

async function resolveCanSellerRelist(
  supabase: SupabaseClient,
  user: User | null,
  listing: Record<string, unknown> | null,
): Promise<boolean> {
  if (!user || !listing) return false
  const listingId = typeof listing.id === "string" ? listing.id : null
  const ownerId = typeof listing.user_id === "string" ? listing.user_id : null
  if (!listingId || ownerId !== user.id) return false
  if (
    !listingEligibleForSellerRelist({
      status: typeof listing.status === "string" ? listing.status : null,
      sold_off_platform: listing.sold_off_platform === true,
      archived_at: typeof listing.archived_at === "string" ? listing.archived_at : null,
    })
  ) {
    return false
  }

  const checkoutSold = await listingIdsWithOpenMarketplaceCheckout(supabase, [listingId])
  if (checkoutSold.error) return false
  return !checkoutSold.listingIds.has(listingId)
}
