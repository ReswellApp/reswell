import { unstable_cache } from "next/cache"
import { fetchSaleListingsPage } from "@/lib/db/saleListings"
import { SALE_FEED_PAGE_SIZE } from "@/lib/sale-feed"
import { getDb } from "@/lib/supabase/db"

/**
 * `/sale` — active listings with a public markdown (`compare_at_price`).
 * Held until the next price change, publish, hide, or sale, with an hourly backstop.
 */
export const SALE_FEED_CACHE_TAG = "sale-feed"
export const SALE_FEED_REVALIDATE_SECONDS = 60 * 60

/** Primary read so a refill after invalidation cannot cache a lagging replica. */
function saleFeedReadClient() {
  return getDb({ consistency: "strong" })
}

const getCachedSaleFeedPagePayload = unstable_cache(
  async (page: number) => {
    const supabase = saleFeedReadClient()
    const { listings, totalCount } = await fetchSaleListingsPage(supabase, { page })
    const totalPages = Math.max(1, Math.ceil(totalCount / SALE_FEED_PAGE_SIZE))
    return { listings, totalCount, totalPages }
  },
  ["sale-feed-v1"],
  {
    revalidate: SALE_FEED_REVALIDATE_SECONDS,
    tags: [SALE_FEED_CACHE_TAG],
  },
)

export function getCachedSaleFeedPage(page: number) {
  const safePage = Math.max(1, Math.floor(page) || 1)
  if (process.env.NODE_ENV === "development") {
    return fetchSaleListingsPage(saleFeedReadClient(), { page: safePage }).then(
      ({ listings, totalCount }) => ({
        listings,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / SALE_FEED_PAGE_SIZE)),
      }),
    )
  }
  return getCachedSaleFeedPagePayload(safePage)
}
