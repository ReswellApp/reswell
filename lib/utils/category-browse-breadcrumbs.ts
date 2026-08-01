/**
 * Detects query state on a category browse URL that means the user is "under"
 * a breadcrumb (search, filters, sort, pagination, etc.).
 */
export function categoryBrowseHasDynamicParams(
  searchParams: Record<string, string | string[] | undefined>,
  ignoreKeys: readonly string[] = [],
): boolean {
  const ignore = new Set(ignoreKeys)
  for (const [key, value] of Object.entries(searchParams)) {
    if (ignore.has(key)) continue
    if (value == null) continue
    if (Array.isArray(value)) {
      if (value.some((entry) => String(entry).trim() !== "")) return true
      continue
    }
    const trimmed = String(value).trim()
    if (!trimmed) continue
    // Default first page is not a deeper view than the base crumb.
    if (key === "page" && trimmed === "1") continue
    return true
  }
  return false
}
