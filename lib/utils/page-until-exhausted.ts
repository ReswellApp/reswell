/** PostgREST silently caps a single select at this many rows. */
export const POSTGREST_PAGE_SIZE = 1000

/**
 * Walk a ranged select until a short page. Use this for unbounded PostgREST
 * snapshots so leftovers past the first ~1000 rows are not dropped.
 */
export async function pageUntilExhausted<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize: number = POSTGREST_PAGE_SIZE,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("pageSize must be a positive integer")
  }

  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1)
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}
