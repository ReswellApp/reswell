import { cache } from "react"
import { unstable_cache } from "next/cache"
import { findListingByParam } from "@/lib/listing-query"
import {
  SHOP_LISTING_SELECT,
  SURFBOARD_LISTING_SELECT,
} from "@/lib/listing-detail-cache-selects"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

/** Hourly cache for anonymous `/l/[listing]` metadata + page shells. */
export const LISTING_PUBLIC_DETAIL_CACHE_TAG = "listing-public-detail"
export const LISTING_PUBLIC_DETAIL_REVALIDATE_SECONDS = 60 * 60

/** Per URL param (`id` or `slug`) so a hide can expire one listing without busting the catalog. */
export function listingPublicDetailCacheTag(param: string): string {
  return `${LISTING_PUBLIC_DETAIL_CACHE_TAG}:${param.trim()}`
}

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

function listingPublicDetailCacheTags(param: string): string[] {
  return [LISTING_PUBLIC_DETAIL_CACHE_TAG, listingPublicDetailCacheTag(param)]
}

/** One hourly row per param — metadata, route shell, and peer PDP detail share this entry. */
function getCachedPublicListingDetailRow(param: string): Promise<PublicListingLookupResult> {
  return unstable_cache(
    () => loadPublicListingByParam(param, SURFBOARD_LISTING_SELECT),
    ["listing-public-detail", param],
    {
      revalidate: LISTING_PUBLIC_DETAIL_REVALIDATE_SECONDS,
      tags: listingPublicDetailCacheTags(param),
    },
  )()
}

function getCachedPublicShopListingRow(param: string): Promise<PublicListingLookupResult> {
  return unstable_cache(
    () => loadPublicListingByParam(param, SHOP_LISTING_SELECT, "new"),
    ["listing-public-shop-detail-v2", param],
    {
      revalidate: LISTING_PUBLIC_DETAIL_REVALIDATE_SECONDS,
      tags: listingPublicDetailCacheTags(param),
    },
  )()
}

/** Per-request dedupe across metadata, route shell, and detail in the same RSC tree. */
export const getCachedPublicListingForMetadata = cache(async (param: string) => {
  return getCachedPublicListingDetailRow(param)
})

export const getCachedPublicListingForRoute = cache(async (param: string) => {
  return getCachedPublicListingDetailRow(param)
})

export const getCachedPublicSurfboardListing = cache(async (param: string) => {
  return getCachedPublicListingDetailRow(param)
})

export const getCachedPublicShopListing = cache(async (param: string) => {
  return getCachedPublicShopListingRow(param)
})
