import { unstable_cache } from "next/cache"
import {
  fetchNewestActiveListingsPage,
  NEW_LISTINGS_FEED_PAGE_SIZE,
} from "@/lib/db/curatedRecentListings"
import { soldSurfboardListingUsedShippingFulfillment } from "@/lib/db/soldSurfboardShippingFulfillment"
import { LISTING_PUBLIC_DETAIL_CACHE_TAG } from "@/lib/cache/listing-public-detail"
import { loadMarketplaceSoldFeed, type MarketplaceSoldFeedPayload } from "@/lib/services/marketplaceSoldFeed"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

/** Hourly cache for anonymous `/sold` sold + shipped feeds. */
export const MARKETPLACE_SOLD_FEED_CACHE_TAG = "marketplace-sold-feed"
export const MARKETPLACE_SOLD_FEED_REVALIDATE_SECONDS = 60 * 60

const BRAND_NONE = "__none__"

const getCachedSoldFeedPayload = unstable_cache(
  async (brandKey: string, shippedOnly: boolean): Promise<MarketplaceSoldFeedPayload> => {
    const supabase = createAnonSupabaseClient()
    return loadMarketplaceSoldFeed(supabase, brandKey === BRAND_NONE ? null : brandKey, {
      shippedOnly,
    })
  },
  ["marketplace-sold-feed-v1"],
  {
    revalidate: MARKETPLACE_SOLD_FEED_REVALIDATE_SECONDS,
    tags: [MARKETPLACE_SOLD_FEED_CACHE_TAG],
  },
)

export function getCachedMarketplaceSoldFeed(
  brandSlug: string | null,
  shippedOnly: boolean,
): Promise<MarketplaceSoldFeedPayload> {
  return getCachedSoldFeedPayload(brandSlug?.trim() || BRAND_NONE, shippedOnly)
}

const getCachedNewListingsFeedPagePayload = unstable_cache(
  async (page: number) => {
    const supabase = createAnonSupabaseClient()
    const { listings, totalCount } = await fetchNewestActiveListingsPage(supabase, {
      categoryId: null,
      page,
    })
    const totalPages = Math.max(1, Math.ceil(totalCount / NEW_LISTINGS_FEED_PAGE_SIZE))
    return { listings, totalCount, totalPages }
  },
  ["marketplace-new-listings-feed-v1"],
  {
    revalidate: MARKETPLACE_SOLD_FEED_REVALIDATE_SECONDS,
    tags: [MARKETPLACE_SOLD_FEED_CACHE_TAG],
  },
)

export function getCachedMarketplaceNewListingsFeedPage(page: number) {
  return getCachedNewListingsFeedPagePayload(page)
}

export const getCachedSoldSurfboardUsedShippingFulfillment = unstable_cache(
  soldSurfboardListingUsedShippingFulfillment,
  ["sold-surfboard-used-shipping-fulfillment-v1"],
  {
    revalidate: MARKETPLACE_SOLD_FEED_REVALIDATE_SECONDS,
    tags: [MARKETPLACE_SOLD_FEED_CACHE_TAG, LISTING_PUBLIC_DETAIL_CACHE_TAG],
  },
)
