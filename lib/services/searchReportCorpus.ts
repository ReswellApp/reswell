/**
 * Shared search telemetry corpus for daily, monthly, and all-time Gemini reports.
 */

import { aggregateDemandCaptureByQuery } from "@/lib/db/searchDemandCapture"
import type { SearchDailyReportSnapshot } from "@/lib/db/searchDailyReports"
import {
  aggregateMarketplaceQueriesForDailyReport,
  aggregateNavBarMarketplaceKeywordAnalytics,
  aggregateSearchAnalytics,
  listMarketplaceSearchEvents,
} from "@/lib/elasticsearch/search-analytics-index"
import {
  aggregateHeaderNavSuggestClickAnalytics,
  aggregateSearchSuggestPicks,
  aggregateSearchSuggestTopSelections,
  listHeaderNavSuggestPickEvents,
  type SearchSuggestSelectionRow,
} from "@/lib/elasticsearch/search-suggest-analytics-index"
import {
  loadCatalogHintsForQueries,
  loadExistingSynonymSummaries,
  type CatalogHint,
} from "@/lib/services/searchDailyReportSynonyms"
import { createServiceRoleClient } from "@/lib/supabase/server"

export const SEARCH_REPORT_DAILY_CORPUS = {
  topQuerySize: 120,
  zeroQuerySize: 80,
  uniquePrecision: 4000,
  demandCaptureSize: 30,
  eventSampleCap: 200,
  dropdownEventCap: 120,
  topSelectionsSize: 40,
  catalogHintQueryCap: 20,
} as const

export const SEARCH_REPORT_MONTHLY_CORPUS = {
  topQuerySize: 200,
  zeroQuerySize: 120,
  uniquePrecision: 8000,
  demandCaptureSize: 80,
  eventSampleCap: 250,
  dropdownEventCap: 150,
  topSelectionsSize: 80,
  catalogHintQueryCap: 40,
} as const

export const SEARCH_REPORT_ALL_TIME_CORPUS = {
  topQuerySize: 250,
  zeroQuerySize: 150,
  uniquePrecision: 10000,
  demandCaptureSize: 100,
  eventSampleCap: 300,
  dropdownEventCap: 180,
  topSelectionsSize: 100,
  catalogHintQueryCap: 50,
} as const

export type SearchReportCorpusOptions = {
  topQuerySize: number
  zeroQuerySize: number
  uniquePrecision: number
  demandCaptureSize: number
  eventSampleCap: number
  dropdownEventCap: number
  topSelectionsSize: number
  catalogHintQueryCap: number
}

export type RankedSearchQuery = { query: string; count: number }
export type RankedDemandCapture = { query: string; count: number; people: number }

export type SearchReportRanked = {
  topQueries: RankedSearchQuery[]
  zeroResultQueries: RankedSearchQuery[]
  topSelections: SearchSuggestSelectionRow[]
  demandCaptureByQuery: RankedDemandCapture[]
}

export type SearchReportCorpus = {
  snapshot: SearchDailyReportSnapshot
  ranked: SearchReportRanked
  promptPayload: Record<string, unknown>
  catalogHints: CatalogHint[]
}

export async function collectSearchReportCorpus(
  fromIso: string,
  toExclusiveIso: string,
  opts: SearchReportCorpusOptions = SEARCH_REPORT_DAILY_CORPUS,
): Promise<SearchReportCorpus> {
  const toInclusiveIso = new Date(new Date(toExclusiveIso).getTime() - 1).toISOString()

  const [
    dayQueries,
    mainAgg,
    suggestPicks,
    topSelections,
    navMp,
    navSuggest,
    searchEvents,
    dropdownEvents,
  ] = await Promise.all([
    aggregateMarketplaceQueriesForDailyReport(fromIso, toExclusiveIso, {
      topSize: opts.topQuerySize,
      zeroSize: opts.zeroQuerySize,
      uniquePrecision: opts.uniquePrecision,
    }),
    aggregateSearchAnalytics(fromIso, toInclusiveIso),
    aggregateSearchSuggestPicks(fromIso, toInclusiveIso),
    aggregateSearchSuggestTopSelections(fromIso, toExclusiveIso, opts.topSelectionsSize),
    aggregateNavBarMarketplaceKeywordAnalytics(fromIso, toInclusiveIso),
    aggregateHeaderNavSuggestClickAnalytics(fromIso, toInclusiveIso),
    listMarketplaceSearchEvents(fromIso, toExclusiveIso, opts.eventSampleCap),
    listHeaderNavSuggestPickEvents(fromIso, toInclusiveIso, opts.dropdownEventCap),
  ])

  let demandCapture = {
    total: 0,
    uniquePeople: 0,
    byQuery: [] as RankedDemandCapture[],
  }
  try {
    const service = createServiceRoleClient()
    const raw = await aggregateDemandCaptureByQuery(
      service,
      fromIso,
      toExclusiveIso,
      opts.demandCaptureSize,
    )
    demandCapture = {
      total: raw.total,
      uniquePeople: raw.uniquePeople,
      byQuery: raw.byQuery.slice(0, opts.demandCaptureSize).map((q) => ({
        query: q.query,
        count: q.count,
        people: q.people,
      })),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[searchReportCorpus] demand capture failed:", msg)
  }

  const topQueries = dayQueries?.topQueries ?? []
  const zeroResultQueries = dayQueries?.zeroResultQueries ?? []
  const totalSearches = dayQueries?.totalSearches ?? 0
  const zeroCount = dayQueries?.zeroResultEventCount ?? 0
  const snapshot: SearchDailyReportSnapshot = {
    totalSearches,
    uniqueQueriesApprox: dayQueries?.uniqueQueriesApprox ?? 0,
    zeroResultEventCount: zeroCount,
    zeroResultShare: totalSearches > 0 ? zeroCount / totalSearches : null,
    avgResultCount: dayQueries?.avgResultCount ?? null,
    dropdownClicks: suggestPicks?.totalClicks ?? 0,
    dropdownHovers: suggestPicks?.totalHovers ?? 0,
    navFreeFormSubmits: navMp?.totalSubmits ?? 0,
    navDropdownSelections: navSuggest?.totalClicks ?? 0,
    brandDirectorySearches: mainAgg?.brandDirectory.totalSearches ?? 0,
    brandDirectoryZeroResults: mainAgg?.brandDirectory.zeroResultEventCount ?? 0,
    demandCaptureTotal: demandCapture.total,
    eventSampleCount: searchEvents.length,
  }

  const ranked: SearchReportRanked = {
    topQueries,
    zeroResultQueries,
    topSelections,
    demandCaptureByQuery: demandCapture.byQuery,
  }

  const promptPayload: Record<string, unknown> = {
    marketplace: {
      totalSearches: snapshot.totalSearches,
      uniqueQueriesApprox: snapshot.uniqueQueriesApprox,
      zeroResultEventCount: snapshot.zeroResultEventCount,
      zeroResultShare: snapshot.zeroResultShare,
      avgResultCount: snapshot.avgResultCount,
      topQueries,
      zeroResultQueries,
      resultCountDistribution: mainAgg?.resultCountDistribution ?? [],
      topCategorySlugs: mainAgg?.topCategorySlugs ?? [],
      recentSearchEvents: searchEvents.map((e) => ({
        at: e.occurredAt,
        query: e.queryDisplay,
        resultCount: e.resultCount,
        origin: e.originSurface,
      })),
    },
    dropdown: {
      totalClicks: snapshot.dropdownClicks,
      totalHovers: snapshot.dropdownHovers,
      byKind: suggestPicks?.byKind ?? [],
      byTrace: suggestPicks?.byTrace ?? [],
      topQueryPrefixes: suggestPicks?.topQueryPrefixesClicks ?? [],
      topSelections,
      topListingClicks: (suggestPicks?.topListingClicks ?? []).map((r) => ({
        title: r.title,
        count: r.count,
      })),
      recentPicks: dropdownEvents.map((e) => ({
        at: e.occurredAt,
        typed: e.queryPrefix,
        selected: e.selectionLabel,
        kind: e.pickKind,
      })),
    },
    headerNav: {
      freeFormSubmits: snapshot.navFreeFormSubmits,
      dropdownSelections: snapshot.navDropdownSelections,
      topFreeFormQueries: navMp?.topQueries ?? [],
    },
    brandDirectory: {
      totalSearches: snapshot.brandDirectorySearches,
      zeroResultEventCount: snapshot.brandDirectoryZeroResults,
      topQueries: mainAgg?.brandDirectory.topQueries ?? [],
      zeroResultQueries: mainAgg?.brandDirectory.zeroResultQueries ?? [],
    },
    demandCapture,
    rankedDemand: {
      mostSearched: topQueries,
      emptyResultQueries: zeroResultQueries,
      notifyMe: demandCapture.byQuery,
      dropdownSelections: topSelections.map((row) => ({
        label: row.label,
        kind: row.kind,
        count: row.count,
      })),
    },
  }

  const zeroQueries = zeroResultQueries.map((row) => row.query)
  const [catalogHints, existingSynonyms] = await Promise.all([
    loadCatalogHintsForQueries(zeroQueries, opts.catalogHintQueryCap),
    loadExistingSynonymSummaries(),
  ])
  promptPayload.catalogHints = catalogHints
  promptPayload.existingSynonyms = existingSynonyms

  return { snapshot, ranked, promptPayload, catalogHints }
}
