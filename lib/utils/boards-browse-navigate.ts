import { scrollPageToTop } from "@/lib/utils/scroll-page-to-top"

/** Query keys that only affect pagination — changing them must not reset `page`. */
export const BOARDS_BROWSE_PAGE_PARAM = "page"

type BrowseRouterReplace = {
  replace: (href: string, options?: { scroll?: boolean }) => void
}

export type BoardsBrowseNavigateOptions = {
  /**
   * When false, pagination may change without resetting other state.
   * When true (default), filter mutations clear `page` only if filters actually changed.
   */
  resetPage?: boolean
}

/**
 * Clone current browse params, apply a mutation, and optionally reset pagination.
 * Returns `null` when a filter mutation would not change the URL (avoids stripping `page`).
 */
export function mutateBoardsBrowseSearchParams(
  current: URLSearchParams | string,
  mutate: (params: URLSearchParams) => void,
  options?: BoardsBrowseNavigateOptions,
): URLSearchParams | null {
  const params = new URLSearchParams(typeof current === "string" ? current : current.toString())
  const filtersBefore = boardsBrowseParamsKeyWithoutPage(params)
  mutate(params)
  const filtersAfter = boardsBrowseParamsKeyWithoutPage(params)
  const filtersChanged = filtersBefore !== filtersAfter
  const resetPage = options?.resetPage !== false

  if (!filtersChanged && resetPage) {
    return null
  }

  if (resetPage && filtersChanged) {
    params.delete(BOARDS_BROWSE_PAGE_PARAM)
  }

  return params
}

/**
 * Replace the browse query string without Next.js default scroll restoration.
 * Filter changes (`resetPage` default) jump to page 1 and the top of the page.
 * Pagination (`resetPage: false`) leaves scroll to the pagination hook.
 */
export function replaceBrowseSearchParams(
  router: BrowseRouterReplace,
  pathname: string,
  next: URLSearchParams,
  navOptions?: BoardsBrowseNavigateOptions,
): void {
  const qs = next.toString()
  router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
  if (navOptions?.resetPage !== false) {
    scrollPageToTop()
  }
}

export function boardsBrowseSearchParamsEqual(a: URLSearchParams, b: URLSearchParams): boolean {
  return a.toString() === b.toString()
}

/** Serialize browse params for comparisons, ignoring pagination. */
export function boardsBrowseParamsKeyWithoutPage(params: URLSearchParams): string {
  const copy = new URLSearchParams(params.toString())
  copy.delete(BOARDS_BROWSE_PAGE_PARAM)
  return copy.toString()
}
