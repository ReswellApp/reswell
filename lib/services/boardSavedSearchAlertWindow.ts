/**
 * A saved-search alert may only fire for a surfboard that was first published
 * after the search was saved. Boards already on the site stay quiet.
 */
export function listingListedAfterSavedSearch(
  listedAt: string | null | undefined,
  searchCreatedAt: string | null | undefined,
): boolean {
  const listed = Date.parse(listedAt ?? "")
  const saved = Date.parse(searchCreatedAt ?? "")
  if (!Number.isFinite(listed) || !Number.isFinite(saved)) return false
  return listed > saved
}
