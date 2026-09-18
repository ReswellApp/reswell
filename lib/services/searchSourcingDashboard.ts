import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import {
  aggregateMarketplaceSourcingDashboard,
  countMarketplaceSearchesInRange,
  getMarketplaceOccurredAtBounds,
  MARKETPLACE_SOURCING_QUERY_LIMIT,
  topQueriesInRange,
} from "@/lib/elasticsearch/search-analytics-index"
import {
  addBusinessDays,
  BUSINESS_TIMEZONE,
  businessDayKey,
  businessDayKeyFromMs,
  businessDayStartMs,
} from "@/lib/utils/business-timezone"
import {
  buildCumulativeVolume,
  classifySearchInventory,
  fillDailyVolume,
  type SearchCumulativePoint,
  type SearchSourcingInventory,
} from "@/lib/utils/search-sourcing-dashboard"

export type SearchSourcingQueryRow = {
  query: string
  display: string
  count: number
  avgResultCount: number | null
  inventory: SearchSourcingInventory
}

export type SearchSourcingDashboard = {
  configured: boolean
  todayCount: number
  weekCount: number
  allTimeCount: number
  uniqueQueriesApprox: number
  firstOccurredAt: string | null
  todayFrom: string
  weekFrom: string
  from: string
  to: string
  volumeByDay: SearchCumulativePoint[]
  topQueries: SearchSourcingQueryRow[]
  /** True when unique queries exceed the all-time list cap. */
  allQueriesTruncated: boolean
  zeroResultQueries: { query: string; count: number }[]
  fetchedAt: string
}

const EMPTY_DASHBOARD: SearchSourcingDashboard = {
  configured: false,
  todayCount: 0,
  weekCount: 0,
  allTimeCount: 0,
  uniqueQueriesApprox: 0,
  firstOccurredAt: null,
  todayFrom: "",
  weekFrom: "",
  from: "",
  to: "",
  volumeByDay: [],
  topQueries: [],
  allQueriesTruncated: false,
  zeroResultQueries: [],
  fetchedAt: "",
}

export async function getSearchSourcingDashboardService(): Promise<SearchSourcingDashboard> {
  const fetchedAt = new Date().toISOString()

  if (!isElasticsearchConfigured()) {
    return { ...EMPTY_DASHBOARD, fetchedAt }
  }

  const now = Date.now()
  const todayKey = businessDayKeyFromMs(now)
  const todayFrom = new Date(businessDayStartMs(todayKey)).toISOString()
  const weekFrom = new Date(businessDayStartMs(addBusinessDays(todayKey, -6))).toISOString()
  const nowIso = new Date(now).toISOString()

  const bounds = await getMarketplaceOccurredAtBounds()
  const allTimeFrom = bounds?.minIso ?? weekFrom

  const [todayCount, weekCount, allTimeCount, sourcing] = await Promise.all([
    countMarketplaceSearchesInRange(todayFrom, nowIso),
    countMarketplaceSearchesInRange(weekFrom, nowIso),
    countMarketplaceSearchesInRange(allTimeFrom, nowIso),
    aggregateMarketplaceSourcingDashboard(allTimeFrom, nowIso, {
      timeZone: BUSINESS_TIMEZONE,
      topSize: MARKETPLACE_SOURCING_QUERY_LIMIT,
      zeroSize: 500,
    }),
  ])

  let topQueryRows = sourcing?.topQueries ?? []
  if (allTimeCount > 0 && topQueryRows.length === 0) {
    const fallback = await topQueriesInRange(allTimeFrom, nowIso, MARKETPLACE_SOURCING_QUERY_LIMIT)
    topQueryRows = [...fallback.entries()].map(([query, count]) => ({
      query,
      display: query,
      count,
      avgResultCount: null,
    }))
  }

  const uniqueQueriesApprox = sourcing?.uniqueQueriesApprox ?? topQueryRows.length
  const allQueriesTruncated =
    topQueryRows.length >= MARKETPLACE_SOURCING_QUERY_LIMIT &&
    uniqueQueriesApprox > topQueryRows.length

  return {
    configured: true,
    todayCount,
    weekCount,
    allTimeCount,
    uniqueQueriesApprox,
    firstOccurredAt: bounds?.minIso ?? null,
    todayFrom,
    weekFrom,
    from: allTimeFrom,
    to: nowIso,
    volumeByDay: buildCumulativeVolume(
      fillDailyVolume(sourcing?.volumeByDay ?? [], businessDayKey(allTimeFrom), todayKey),
    ),
    topQueries: topQueryRows.map((row) => ({
      query: row.query,
      display: row.display,
      count: row.count,
      avgResultCount: row.avgResultCount,
      inventory: classifySearchInventory(row.avgResultCount),
    })),
    allQueriesTruncated,
    zeroResultQueries: sourcing?.zeroResultQueries ?? [],
    fetchedAt,
  }
}
