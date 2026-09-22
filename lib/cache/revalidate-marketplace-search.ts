import { revalidatePath, revalidateTag } from "next/cache"

/** Shared marketplace `/search` listing payload (query + brand + category). */
export const MARKETPLACE_SEARCH_CACHE_TAG = "marketplace-search"

/** Bust cached `/search` listing results after publish, hide, or brand edits. */
export function revalidateMarketplaceSearch(): void {
  revalidateTag(MARKETPLACE_SEARCH_CACHE_TAG, "max")
  revalidatePath("/search", "page")
}
