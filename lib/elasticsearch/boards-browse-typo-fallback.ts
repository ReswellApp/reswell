/**
 * Typo recovery is for an empty browse page. A saved-search check asks whether
 * one listing matches, so a miss must stay a miss — fuzzy "lost" hits "last".
 */
export function boardsBrowseUsesTypoFallback(params: {
  typoFallback?: boolean
  restrictToIds?: string[]
}): boolean {
  if (params.typoFallback === false) return false
  if ((params.restrictToIds?.filter(Boolean) ?? []).length > 0) return false
  return true
}
