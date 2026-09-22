import { revalidateTag } from "next/cache"
import { NAV_SEARCH_SUGGEST_CACHE_TAG } from "@/lib/cache/nav-search-suggest"
import { revalidateMarketplaceSearch } from "@/lib/cache/revalidate-marketplace-search"

/** Bust cached header nav typeahead after a listing is published or a brand is added. */
export function revalidateNavSearchSuggest(): void {
  revalidateTag(NAV_SEARCH_SUGGEST_CACHE_TAG, 'max')
  revalidateMarketplaceSearch()
}
