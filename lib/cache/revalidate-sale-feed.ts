import { revalidatePath, revalidateTag } from "next/cache"
import { SALE_FEED_CACHE_TAG } from "@/lib/cache/sale-feed"

const EXPIRE_NOW = { expire: 0 } as const

/**
 * Drop `/sale` immediately after a markdown, price drop, publish, hide, or sale.
 * A stale-while-revalidate bust leaves the previous grid in place.
 */
export function revalidateSaleFeedCatalog(): void {
  revalidateTag(SALE_FEED_CACHE_TAG, EXPIRE_NOW)
  revalidatePath("/sale", "page")
  revalidatePath("/sale", "layout")
}
