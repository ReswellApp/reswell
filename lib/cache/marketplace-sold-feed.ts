import { unstable_cache } from "next/cache"
import {
  fetchNewestActiveListingsPage,
  NEW_LISTINGS_FEED_PAGE_SIZE,
} from "@/lib/db/curatedRecentListings"
import { soldSurfboardListingUsedShippingFulfillment } from "@/lib/db/soldSurfboardShippingFulfillment"
import { LISTING_PUBLIC_DETAIL_CACHE_TAG } from "@/lib/cache/listing-public-detail"
import {
  loadMarketplaceShippedFeedPage,
  loadMarketplaceSoldFeed,
  type MarketplaceShippedFeedPayload,
  type MarketplaceSoldFeedPayload,
} from "@/lib/services/marketplaceSoldFeed"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

/** Hourly cache for anonymous `/sold` sold + shipped feeds. */
export const MARKETPLACE_SOLD_FEED_CACHE_TAG = "marketplace-sold-feed"
export const MARKETPLACE_SOLD_FEED_REVALIDATE_SECONDS = 60 * 60

const BRAND_NONE = "__none__"

/** Stats can load while the listing grid fetch fails; never serve or retain that split state. */
function isPoisonedSoldFeedPayload(
  payload: MarketplaceSoldFeedPayload,
  options: { shippedOnly: boolean; brandSlug: string | null },
): boolean {
  if (options.shippedOnly || options.brandSlug || payload.brandUnknown) return false
  return payload.soldStats.count > 0 && payload.soldListings.length === 0
}

const getCachedSoldFeedPayload = unstable_cache(
  async (brandKey: string, shippedOnly: boolean): Promise<MarketplaceSoldFeedPayload> => {
    const supabase = createAnonSupabaseClient()
    const brandSlug = brandKey === BRAND_NONE ? null : brandKey
    const payload = await loadMarketplaceSoldFeed(supabase, brandSlug, { shippedOnly })

    if (isPoisonedSoldFeedPayload(payload, { shippedOnly, brandSlug })) {
      console.error(
        "[marketplace-sold-feed] refusing to cache sold feed: stats count > 0 but listing grid empty",
      )
      throw new Error("Sold feed payload inconsistent — skip cache")
    }

    return payload
  },
  ["marketplace-sold-feed-v11"],
  {
    revalidate: MARKETPLACE_SOLD_FEED_REVALIDATE_SECONDS,
    tags: [MARKETPLACE_SOLD_FEED_CACHE_TAG],
  },
)

export async function getCachedMarketplaceSoldFeed(
  brandSlug: string | null,
  shippedOnly: boolean,
): Promise<MarketplaceSoldFeedPayload> {
  const normalizedBrandSlug = brandSlug?.trim() || null

  if (shippedOnly) {
    const shipped = await getCachedMarketplaceShippedFeedPage(normalizedBrandSlug, 1)
    return {
      soldListings: shipped.soldListings,
      soldStats: { count: shipped.totalCount, gmvFormatted: "" },
      brandFilterName: shipped.brandFilterName,
      brandUnknown: shipped.brandUnknown,
      hasMore: shipped.totalPages > 1,
      nextCursor: null,
    }
  }

  // Dev: skip `unstable_cache` so RPC/migration fixes show up without waiting out the 1h TTL
  // or restarting after an earlier failed fetch cached an empty listing grid.
  if (process.env.NODE_ENV === "development") {
    const supabase = createAnonSupabaseClient()
    return loadMarketplaceSoldFeed(supabase, normalizedBrandSlug, { shippedOnly: false })
  }

  const cached = await getCachedSoldFeedPayload(normalizedBrandSlug || BRAND_NONE, false)
  if (isPoisonedSoldFeedPayload(cached, { shippedOnly: false, brandSlug: normalizedBrandSlug })) {
    console.warn(
      "[marketplace-sold-feed] cached sold feed is inconsistent — refetching without cache",
    )
    const supabase = createAnonSupabaseClient()
    return loadMarketplaceSoldFeed(supabase, normalizedBrandSlug, { shippedOnly: false })
  }

  return cached
}

const getCachedShippedFeedPagePayload = unstable_cache(
  async (brandKey: string, page: number): Promise<MarketplaceShippedFeedPayload> => {
    const supabase = createAnonSupabaseClient()
    const brandSlug = brandKey === BRAND_NONE ? null : brandKey
    return loadMarketplaceShippedFeedPage(supabase, brandSlug, page)
  },
  ["marketplace-shipped-feed-v1"],
  {
    revalidate: MARKETPLACE_SOLD_FEED_REVALIDATE_SECONDS,
    tags: [MARKETPLACE_SOLD_FEED_CACHE_TAG],
  },
)

export async function getCachedMarketplaceShippedFeedPage(
  brandSlug: string | null,
  page: number,
): Promise<MarketplaceShippedFeedPayload> {
  const normalizedBrandSlug = brandSlug?.trim() || null
  const safePage = Math.max(1, Math.floor(page) || 1)

  if (process.env.NODE_ENV === "development") {
    const supabase = createAnonSupabaseClient()
    return loadMarketplaceShippedFeedPage(supabase, normalizedBrandSlug, safePage)
  }

  return getCachedShippedFeedPagePayload(normalizedBrandSlug || BRAND_NONE, safePage)
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
