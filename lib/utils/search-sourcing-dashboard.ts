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

export function buildCumulativeVolume(
  volumeByDay: SearchVolumePoint[],
): SearchCumulativePoint[] {
  let running = 0
  return volumeByDay.map((row) => {
    running += row.count
    return { date: row.date, count: row.count, cumulative: running }
  })
}
