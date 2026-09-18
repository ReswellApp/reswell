export type SearchSourcingInventory = "none" | "thin" | "stocked"

/** Average listings at or below this count is treated as thin inventory. */
export const THIN_INVENTORY_AVG_RESULTS = 3

export function classifySearchInventory(
  avgResultCount: number | null,
): SearchSourcingInventory {
  if (avgResultCount == null) return "stocked"
  if (avgResultCount <= 0) return "none"
  if (avgResultCount < THIN_INVENTORY_AVG_RESULTS) return "thin"
  return "stocked"
}

export type SearchVolumePoint = {
  date: string
  count: number
}

export type SearchCumulativePoint = SearchVolumePoint & {
  cumulative: number
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

function nextCivilDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

/**
 * Insert zero-count days so a cumulative chart stays continuous.
 * Returns the original points when none are dated — never invent a zero series.
 */
export function fillDailyVolume(
  volumeByDay: SearchVolumePoint[],
  fromDateKey: string,
  toDateKey: string,
): SearchVolumePoint[] {
  const known = volumeByDay.filter((row) => DATE_KEY.test(row.date))
  if (known.length === 0) return []

  const counts = new Map<string, number>()
  for (const row of known) {
    counts.set(row.date, (counts.get(row.date) ?? 0) + row.count)
  }

  const keys = [...counts.keys()]
  const start = [fromDateKey, ...keys].filter((key) => DATE_KEY.test(key)).sort()[0]
  const end = [toDateKey, ...keys].filter((key) => DATE_KEY.test(key)).sort().at(-1)
  if (!start || !end || start > end) return known

  const filled: SearchVolumePoint[] = []
  let cursor = start
  while (cursor <= end) {
    filled.push({ date: cursor, count: counts.get(cursor) ?? 0 })
    const next = nextCivilDateKey(cursor)
    if (next <= cursor) break
    cursor = next
  }
  return filled
}

export function buildCumulativeVolume(
  volumeByDay: SearchVolumePoint[],
): SearchCumulativePoint[] {
  let running = 0
  return volumeByDay.map((row) => {
    running += row.count
    return { date: row.date, count: row.count, cumulative: running }
  })
}

export function matchesSearchSourcingQuery(
  row: { query: string; display: string },
  needle: string,
): boolean {
  const q = needle.trim().toLowerCase()
  if (!q) return true
  return row.display.toLowerCase().includes(q) || row.query.toLowerCase().includes(q)
}

export function filterSearchSourcingQueries<T extends { query: string; display: string }>(
  rows: T[],
  needle: string,
): T[] {
  const q = needle.trim()
  if (!q) return rows
  return rows.filter((row) => matchesSearchSourcingQuery(row, q))
}
