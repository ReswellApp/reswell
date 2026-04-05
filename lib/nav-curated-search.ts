type AppRouterLike = {
  push: (href: string) => void
  refresh: () => void | Promise<void>
}

/** Canonical URL for the curated “recently listed” feed (empty keyword search). */
export const CURATED_RECENT_SEARCH_PATH = "/search/recent"

export function curatedRecentSearchHref(currentQueryString: string): string {
  const params = new URLSearchParams(currentQueryString)
  const category = params.get("category")?.trim()
  if (category) {
    return `${CURATED_RECENT_SEARCH_PATH}?category=${encodeURIComponent(category)}`
  }
  return CURATED_RECENT_SEARCH_PATH
}

/**
 * Empty search submit: open curated recently-listed feed (not the homepage).
 * If already on that URL, refresh server data.
 */
export async function goToCuratedSearchPage(
  router: AppRouterLike,
  pathname: string,
  currentQueryString: string,
): Promise<void> {
  const target = curatedRecentSearchHref(currentQueryString)
  const params = new URLSearchParams(currentQueryString)
  const alreadyThere =
    pathname === CURATED_RECENT_SEARCH_PATH && !params.get("q")?.trim()
  if (alreadyThere) {
    await Promise.resolve(router.refresh())
    return
  }
  router.push(target)
}
