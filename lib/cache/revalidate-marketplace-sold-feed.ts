import { revalidatePath, revalidateTag } from "next/cache"
import { MARKETPLACE_SOLD_FEED_CACHE_TAG } from "@/lib/cache/marketplace-sold-feed"

const EXPIRE_NOW = { expire: 0 } as const

/**
 * Drop `/sold` feed caches immediately after a sale, purchase, or return.
 * A stale-while-revalidate bust leaves the previous grid in place, so the next
 * render can store that grid for another hour.
 */
export function revalidateMarketplaceSoldFeedCatalog(): void {
  revalidateTag(MARKETPLACE_SOLD_FEED_CACHE_TAG, EXPIRE_NOW)
  revalidatePath("/sold", "page")
  revalidatePath("/sold", "layout")
}
