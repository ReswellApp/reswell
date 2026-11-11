import { headerNavSearchSubmitHref } from "@/lib/header-nav-marketplace-search"

/**
 * Header nav submit target. Always synchronous — Enter must navigate even when
 * suggest analytics or personalization requests are in flight.
 *
 * Unique catalog-model lookups stay on `/search` until
 * `MARKETPLACE_SEARCH_OPENS_MODEL_PAGES` is flipped on (server-side redirect
 * on the results page handles that path; do not await a model-page lookup
 * before `router.push`).
 */
export function hrefForNavMarketplaceSearch(
  term: string,
  pathname?: string | null,
  searchParams?: Pick<URLSearchParams, "get">,
): string {
  return headerNavSearchSubmitHref(term, pathname, searchParams)
}
