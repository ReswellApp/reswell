import { revalidatePath, revalidateTag } from "next/cache"
import {
  MARKETPLACE_NEW_LISTINGS_FEED_CACHE_TAG,
  MARKETPLACE_SOLD_FEED_CACHE_TAG,
} from "@/lib/cache/marketplace-sold-feed"

const EXPIRE_NOW = { expire: 0 } as const

function revalidateSoldPage(): void {
  revalidatePath("/sold", "page")
  revalidatePath("/sold", "layout")
}

/**
 * Drop the `/sold?tab=new` grid as soon as a board is published, hidden,
 * restored, or deleted. A path-only bust leaves the previous grid in the
 * data cache, and the next render stores it for another hour.
 */
export function revalidateMarketplaceNewListingsFeed(): void {
  revalidateTag(MARKETPLACE_NEW_LISTINGS_FEED_CACHE_TAG, EXPIRE_NOW)
  revalidateSoldPage()
}

/**
 * Drop `/sold` feed caches immediately after a sale, purchase, or return.
 * A stale-while-revalidate bust leaves the previous grid in place, so the next
 * render can store that grid for another hour.
 */
export function revalidateMarketplaceSoldFeedCatalog(): void {
  revalidateTag(MARKETPLACE_SOLD_FEED_CACHE_TAG, EXPIRE_NOW)
  revalidateTag(MARKETPLACE_NEW_LISTINGS_FEED_CACHE_TAG, EXPIRE_NOW)
  revalidateSoldPage()
}
