import {
  mobileMarketplaceFeedSchema,
  type MobileListingCard,
  type MobileMarketplaceFeed,
  type MobileMarketplaceFeedQuery,
} from "@reswell/api-contract"
import { NEW_LISTINGS_FEED_PAGE_SIZE } from "@/lib/db/curatedRecentListings"
import { MARKETPLACE_SOLD_FEED_PAGE_SIZE } from "@/lib/db/marketplace-sold-feed"
import { listMobileListingRowsByIds } from "@/lib/db/mobile-listings"
import {
  getCachedMarketplaceNewListingsFeedPage,
  getCachedMarketplaceShippedFeedPage,
  getCachedMarketplaceSoldFeed,
} from "@/lib/cache/marketplace-sold-feed"
import { MARKETPLACE_SOLD_FEED_LIMIT, loadMarketplaceSoldFeedPage } from "@/lib/services/marketplaceSoldFeed"
import { MOBILE_MARKETPLACE_FEED_COPY, marketplaceFeedStats } from "@/lib/services/mobileMarketplaceFeedCopy"
import { toMobileListingCard, type MobileApiResult } from "@/lib/services/mobileApi"
import { getDb } from "@/lib/supabase/db"

async function cardsForOrderedIds(ids: readonly string[]): Promise<MobileListingCard[] | null> {
  const listed = await listMobileListingRowsByIds(ids)
  if (!listed.ok) {
    console.error("[mobile-api] feed cards failed", {
      timestamp: new Date().toISOString(),
      message: listed.message,
    })
    return null
  }
  return listed.rows.flatMap((row) => {
    const card = toMobileListingCard(row)
    return card ? [card] : []
  })
}

function feedResult(
  payload: MobileMarketplaceFeed,
): MobileApiResult<MobileMarketplaceFeed> {
  const parsed = mobileMarketplaceFeedSchema.safeParse(payload)
  if (!parsed.success) {
    console.error("[mobile-api] feed shape failed", {
      timestamp: new Date().toISOString(),
      issues: parsed.error.issues.map((issue) => issue.path.join(".")),
    })
    return { ok: false, status: 500, error: "Unable to load the feed right now" }
  }
  return { ok: true, data: parsed.data }
}

/**
 * Public marketplace feed for the app. Membership and order come from the
 * same loaders as `https://www.reswell.app/sold`.
 */
export async function getMobileMarketplaceFeedService(
  query: MobileMarketplaceFeedQuery,
): Promise<MobileApiResult<MobileMarketplaceFeed>> {
  const copy = MOBILE_MARKETPLACE_FEED_COPY[query.tab]

  if (query.tab === "new") {
    const page = await getCachedMarketplaceNewListingsFeedPage(query.page)
    const listings = await cardsForOrderedIds(page.listings.map((listing) => listing.id))
    if (!listings) return { ok: false, status: 500, error: "Unable to load the feed right now" }
    return feedResult({
      tab: "new",
      title: copy.title,
      subtitle: copy.subtitle,
      listings,
      page: query.page,
      page_size: NEW_LISTINGS_FEED_PAGE_SIZE,
      has_more: query.page < page.totalPages,
      next_cursor: null,
      stats: marketplaceFeedStats("new", page.totalCount, null),
    })
  }

  if (query.tab === "shipped") {
    const page = await getCachedMarketplaceShippedFeedPage(null, query.page)
    const listings = await cardsForOrderedIds(page.soldListings.map((listing) => listing.id))
    if (!listings) return { ok: false, status: 500, error: "Unable to load the feed right now" }
    return feedResult({
      tab: "shipped",
      title: copy.title,
      subtitle: copy.subtitle,
      listings,
      page: query.page,
      page_size: MARKETPLACE_SOLD_FEED_LIMIT,
      has_more: query.page < page.totalPages,
      next_cursor: null,
      stats: marketplaceFeedStats("shipped", page.totalCount, null),
    })
  }

  if (query.sold_at && query.listing_id) {
    const page = await loadMarketplaceSoldFeedPage(getDb({ consistency: "eventual" }), null, {
      soldAt: query.sold_at,
      listingId: query.listing_id,
    })
    const listings = await cardsForOrderedIds(page.soldListings.map((listing) => listing.id))
    if (!listings) return { ok: false, status: 500, error: "Unable to load the feed right now" }
    return feedResult({
      tab: "sold",
      title: copy.title,
      subtitle: copy.subtitle,
      listings,
      page: 1,
      page_size: MARKETPLACE_SOLD_FEED_PAGE_SIZE,
      has_more: page.hasMore,
      next_cursor:
        page.hasMore && page.nextCursor
          ? { sold_at: page.nextCursor.soldAt, listing_id: page.nextCursor.listingId }
          : null,
      stats: null,
    })
  }

  const page = await getCachedMarketplaceSoldFeed(null, false)
  const listings = await cardsForOrderedIds(page.soldListings.map((listing) => listing.id))
  if (!listings) return { ok: false, status: 500, error: "Unable to load the feed right now" }
  return feedResult({
    tab: "sold",
    title: copy.title,
    subtitle: copy.subtitle,
    listings,
    page: 1,
    page_size: MARKETPLACE_SOLD_FEED_PAGE_SIZE,
    has_more: page.hasMore,
    next_cursor:
      page.hasMore && page.nextCursor
        ? { sold_at: page.nextCursor.soldAt, listing_id: page.nextCursor.listingId }
        : null,
    stats: marketplaceFeedStats("sold", page.soldStats.count, page.soldStats.gmvFormatted),
  })
}
