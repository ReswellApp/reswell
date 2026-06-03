/** Query keys that only affect pagination — changing them must not reset `page`. */
export const BOARDS_BROWSE_PAGE_PARAM = "page"

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

export function boardsBrowseSearchParamsEqual(a: URLSearchParams, b: URLSearchParams): boolean {
  return a.toString() === b.toString()
}

/** Serialize browse params for comparisons, ignoring pagination. */
export function boardsBrowseParamsKeyWithoutPage(params: URLSearchParams): string {
  const copy = new URLSearchParams(params.toString())
  copy.delete(BOARDS_BROWSE_PAGE_PARAM)
  return copy.toString()
}
