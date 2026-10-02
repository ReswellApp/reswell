import { revalidateTag } from "next/cache"

/** Shared `/search` parser + listing results. Public catalog, same for every visitor. */
export const MARKETPLACE_SEARCH_PAGE_CACHE_TAG = "marketplace-search-page"

/** Match `/search/recent`: short enough that new listings show up, long enough to skip repeat work. */
export const MARKETPLACE_SEARCH_PAGE_REVALIDATE_SECONDS = 60

/** Bust cached search intent and results after a listing, brand, or synonym change. */
export function revalidateMarketplaceSearchPage(): void {
  revalidateTag(MARKETPLACE_SEARCH_PAGE_CACHE_TAG, "max")
}
