import { revalidateTag } from "next/cache"
import { revalidateMarketplaceSearchPage } from "@/lib/cache/marketplace-search-page"
import { NAV_SEARCH_SUGGEST_CACHE_TAG } from "@/lib/cache/nav-search-suggest"

/** Bust cached header nav typeahead after a listing is published or a brand is added. */
export function revalidateNavSearchSuggest(): void {
  revalidateTag(NAV_SEARCH_SUGGEST_CACHE_TAG, 'max')
  revalidateMarketplaceSearchPage()
}
