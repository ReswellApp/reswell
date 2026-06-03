import { revalidateTag } from "next/cache"
import { MARKETPLACE_SOLD_FEED_CACHE_TAG } from "@/lib/cache/marketplace-sold-feed"

/** Bust hourly `/sold` sold, shipped, and new-listings feed caches. */
export function revalidateMarketplaceSoldFeedCatalog(): void {
  revalidateTag(MARKETPLACE_SOLD_FEED_CACHE_TAG)
}
