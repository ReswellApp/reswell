type AppRouterLike = {
  push: (href: string) => void
  refresh: () => void | Promise<void>
}

const CURATED_SEARCH = "/search?view=recent"

/**
 * Empty search submit: open curated recently-listed feed on /search (not the homepage).
 * If already on that URL, refresh server data.
 */
export async function goToCuratedSearchPage(
  router: AppRouterLike,
  pathname: string,
  currentQueryString: string,
): Promise<void> {
  const params = new URLSearchParams(currentQueryString)
  const alreadyThere =
    pathname === "/search" &&
    params.get("view") === "recent" &&
    !params.get("q")?.trim()
  if (alreadyThere) {
    await Promise.resolve(router.refresh())
    return
  }
  router.push(CURATED_SEARCH)
}
