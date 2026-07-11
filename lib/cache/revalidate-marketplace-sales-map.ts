import { revalidateTag } from "next/cache"
import { MARKETPLACE_SALES_MAP_CACHE_TAG } from "@/lib/cache/marketplace-sales-map"

/** Bust hourly `/map` sales-flow cache after new marketplace orders. */
export function revalidateMarketplaceSalesMapCatalog(): void {
  revalidateTag(MARKETPLACE_SALES_MAP_CACHE_TAG, "max")
}
