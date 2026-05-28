import { cache } from "react"
import { unstable_cache } from "next/cache"
import { findListingByParam } from "@/lib/listing-query"
import {
  LISTING_META_SELECT,
  LISTING_ROUTE_SHELL_SELECT,
  SHOP_LISTING_SELECT,
  SURFBOARD_LISTING_SELECT,
} from "@/lib/listing-detail-cache-selects"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

/** Hourly cache for anonymous `/l/[listing]` metadata + page shells. */
export const LISTING_PUBLIC_DETAIL_CACHE_TAG = "listing-public-detail"
export const LISTING_PUBLIC_DETAIL_REVALIDATE_SECONDS = 60 * 60

type PublicListingLookupResult = Awaited<ReturnType<typeof findListingByParam>>

async function loadPublicListingByParam(
  param: string,
  select: string,
  section?: string,
): Promise<PublicListingLookupResult> {
  const supabase = createAnonSupabaseClient()
  return findListingByParam(supabase, param, {
    select,
    section,
    includeHiddenListings: false,
  })
}

const getCachedPublicListingMetaRow = unstable_cache(
  (param: string) => loadPublicListingByParam(param, LISTING_META_SELECT),
  ["listing-public-meta"],
  {
    revalidate: LISTING_PUBLIC_DETAIL_REVALIDATE_SECONDS,
    tags: [LISTING_PUBLIC_DETAIL_CACHE_TAG],
  },
)

const getCachedPublicListingRouteShellRow = unstable_cache(
  (param: string) => loadPublicListingByParam(param, LISTING_ROUTE_SHELL_SELECT),
  ["listing-public-route-shell"],
  {
    revalidate: LISTING_PUBLIC_DETAIL_REVALIDATE_SECONDS,
    tags: [LISTING_PUBLIC_DETAIL_CACHE_TAG],
  },
)

const getCachedPublicSurfboardListingRow = unstable_cache(
  (param: string) => loadPublicListingByParam(param, SURFBOARD_LISTING_SELECT, "surfboards"),
  ["listing-public-surfboard-detail"],
  {
    revalidate: LISTING_PUBLIC_DETAIL_REVALIDATE_SECONDS,
    tags: [LISTING_PUBLIC_DETAIL_CACHE_TAG],
  },
)

const getCachedPublicShopListingRow = unstable_cache(
  (param: string) => loadPublicListingByParam(param, SHOP_LISTING_SELECT, "new"),
  ["listing-public-shop-detail"],
  {
    revalidate: LISTING_PUBLIC_DETAIL_REVALIDATE_SECONDS,
    tags: [LISTING_PUBLIC_DETAIL_CACHE_TAG],
  },
)

/** Per-request dedupe across metadata, route shell, and detail in the same RSC tree. */
export const getCachedPublicListingForMetadata = cache(async (param: string) => {
  return getCachedPublicListingMetaRow(param)
})

export const getCachedPublicListingForRoute = cache(async (param: string) => {
  return getCachedPublicListingRouteShellRow(param)
})

export const getCachedPublicSurfboardListing = cache(async (param: string) => {
  return getCachedPublicSurfboardListingRow(param)
})

export const getCachedPublicShopListing = cache(async (param: string) => {
  return getCachedPublicShopListingRow(param)
})
