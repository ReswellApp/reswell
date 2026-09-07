import {
  fetchIntelligenceCommerce,
  fetchIntelligenceGrowth,
  fetchIntelligenceMonthlyHistory,
  fetchIntelligenceTopFirstPartyPaths,
} from "@/lib/db/businessIntelligenceSnapshot"
import { listRecentCompleteReportsForLlm } from "@/lib/db/businessIntelligenceReports"
import { aggregateMarketplaceQueriesForDailyReport } from "@/lib/elasticsearch/search-analytics-index"
import { getAdAttributedSalesDashboard } from "@/lib/services/adAttributedSales"
import { getAdminListingViewsDashboard } from "@/lib/services/adminListingViews"
import { getBrowseButtonAnalyticsForAdmin } from "@/lib/services/browseButtonAnalytics"
import {
  isGoogleAnalyticsConfigured,
  runGoogleAnalyticsReport,
} from "@/lib/services/googleAnalytics"
import { getSellFunnelAnalyticsForAdmin } from "@/lib/services/sellFunnelAnalytics"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type {
  BusinessIntelligenceSnapshot,
  IntelligenceAdsSnapshot,
  IntelligencePriorBriefing,
  IntelligenceRunRateProjection,
  IntelligenceSearchSnapshot,
  IntelligenceTopPath,
} from "@/lib/types/businessIntelligence"
import type { IntelligencePeriodResolved } from "@/lib/utils/businessIntelligencePeriod"

export type { BusinessIntelligenceSnapshot } from "@/lib/types/businessIntelligence"

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function buildRunRate(
  periodDays: number,
  gmv: number,
  orders: number,
  users: number,
  monthlyHistory: { yearMonth: string; gmv: number }[],
): IntelligenceRunRateProjection {
  const days = Math.max(1, periodDays)
  const dailyGmv = gmv / days
  const dailyOrders = orders / days
  const dailyUsers = users / days
  const sorted = [...monthlyHistory].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
  const last = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]
  const momGmvDeltaPct =
    last && prev && prev.gmv > 0 ? ((last.gmv - prev.gmv) / prev.gmv) * 100 : null

  const scale = (n: number) => ({
    gmv: roundMoney(dailyGmv * n),
    orders: Math.round(dailyOrders * n),
    users: Math.round(dailyUsers * n),
  })

  return {
    dailyGmv: roundMoney(dailyGmv),
    dailyOrders: roundMoney(dailyOrders),
    dailyUsers: roundMoney(dailyUsers),
    next7Days: scale(7),
    next30Days: scale(30),
    next90Days: scale(90),
    momGmvDeltaPct,
  }
}

async function fetchGa4TopPages(
  startDate: string,
  endDate: string,
): Promise<IntelligenceTopPath[]> {
  if (!isGoogleAnalyticsConfigured()) return []
  const report = await runGoogleAnalyticsReport({
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
    metrics: [{ name: "screenPageViews" }, { name: "sessions" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 15,
  })
  if (!report.ok) return []
  return report.rows
    .map((row) => ({
      path: row.dimensionValues[0] ?? "",
      title: row.dimensionValues[1] ?? null,
      views: row.metricValues[0] ?? 0,
      sessions: row.metricValues[1] ?? 0,
    }))
    .filter((row) => row.path.length > 0 && !row.path.startsWith("/admin"))
}

async function fetchSearchSlice(
  fromIso: string,
  toIsoExclusive: string,
): Promise<IntelligenceSearchSnapshot> {
  const empty: IntelligenceSearchSnapshot = {
    configured: false,
    totalSearches: 0,
    uniqueQueriesApprox: 0,
    zeroResultEventCount: 0,
    topQueries: [],
    zeroResultQueries: [],
  }
  try {
    const terms = await aggregateMarketplaceQueriesForDailyReport(fromIso, toIsoExclusive)
    if (!terms) return empty
    return {
      configured: true,
      totalSearches: terms.totalSearches,
      uniqueQueriesApprox: terms.uniqueQueriesApprox,
      zeroResultEventCount: terms.zeroResultEventCount,
      topQueries: terms.topQueries.slice(0, 12),
      zeroResultQueries: terms.zeroResultQueries.slice(0, 10),
    }
  } catch {
    return empty
  }
}

async function fetchAdsSlice(periodDays: number): Promise<IntelligenceAdsSnapshot> {
  try {
    const data = await getAdAttributedSalesDashboard({ days: Math.min(90, Math.max(1, periodDays)) })
    if (!data.configured) {
      return {
        configured: false,
        reason: data.reason,
        googleAdsRevenue: 0,
        metaAdsRevenue: 0,
        metaReferralRevenue: 0,
      }
    }
    return {
      configured: true,
      googleAdsRevenue: data.totals.google_ads.revenue,
      metaAdsRevenue: data.totals.meta_ads.revenue,
      metaReferralRevenue: data.totals.meta_referral.revenue,
    }
  } catch {
    return {
      configured: false,
      googleAdsRevenue: 0,
      metaAdsRevenue: 0,
      metaReferralRevenue: 0,
    }
  }
}

function pickMostClicked(
  ga4: IntelligenceTopPath[],
  firstParty: IntelligenceTopPath[],
): IntelligenceTopPath | null {
  if (ga4[0]) return ga4[0]
  if (firstParty[0]) return firstParty[0]
  return null
}

export async function buildBusinessIntelligenceSnapshot(
  period: IntelligencePeriodResolved,
): Promise<BusinessIntelligenceSnapshot> {
  const db = createServiceRoleClient()
  const listingViewsPeriod = period.periodDays <= 10 ? "7d" : "30d"
  const funnelDays = Math.min(90, Math.max(1, period.periodDays))

  const [
    commerce,
    firstPartyPaths,
    monthlyHistory,
    ga4Pages,
    search,
    ads,
    browse,
    sellFunnel,
    listingViews,
    priorRows,
  ] = await Promise.all([
    fetchIntelligenceCommerce(db, period),
    fetchIntelligenceTopFirstPartyPaths(db, period),
    fetchIntelligenceMonthlyHistory(db),
    fetchGa4TopPages(period.startDate, period.endDate),
    fetchSearchSlice(period.fromIso, period.toIsoExclusive),
    fetchAdsSlice(period.periodDays),
    getBrowseButtonAnalyticsForAdmin({ days: funnelDays }).catch(() => null),
    getSellFunnelAnalyticsForAdmin({ days: funnelDays }).catch(() => null),
    getAdminListingViewsDashboard({
      period: listingViewsPeriod,
      page: 1,
      pageSize: 8,
    }).catch(() => null),
    listRecentCompleteReportsForLlm(db, 8),
  ])

  const growth = await fetchIntelligenceGrowth(db, period, commerce.orders.current)

  const priorBriefings: IntelligencePriorBriefing[] = []
  for (const row of priorRows.rows) {
    if (row.period_kind === period.kind && row.period_key === period.periodKey) continue
    const summary = row.report?.executiveSummary?.trim()
    if (!summary) continue
    priorBriefings.push({
      periodKind: row.period_kind,
      periodKey: row.period_key,
      label: `${row.period_kind} ${row.period_key}`,
      executiveSummary: summary.slice(0, 600),
      gmv: row.snapshot?.commerce?.gmv?.current ?? 0,
      orders: row.snapshot?.commerce?.orders?.current ?? 0,
      newUsers: row.snapshot?.growth?.newUsers?.current ?? 0,
    })
    if (priorBriefings.length >= 6) break
  }

  const browseClicks = browse && browse.ok ? browse.data.summary.totalClicks : 0
  const sellSummary = sellFunnel && sellFunnel.ok ? sellFunnel.data.summary : null
  const views = listingViews && listingViews.ok ? listingViews.data.summary : null

  return {
    periodKind: period.kind,
    periodKey: period.periodKey,
    periodLabel: period.label,
    compareLabel: period.compareLabel,
    startDate: period.startDate,
    endDate: period.endDate,
    fromIso: period.fromIso,
    toIsoExclusive: period.toIsoExclusive,
    periodDays: period.periodDays,
    capturedAt: new Date().toISOString(),
    commerce,
    growth,
    topPagesGa4: ga4Pages,
    topPagesFirstParty: firstPartyPaths,
    mostClickedUrl: pickMostClicked(ga4Pages, firstPartyPaths),
    search,
    funnel: {
      sellPublishAttempts: sellSummary?.publishAttempts ?? 0,
      sellPublishSuccesses: sellSummary?.publishSuccesses ?? 0,
      sellSuccessRate: sellSummary?.successRate ?? null,
      browseClicks,
      listingViewEvents: views?.totalViewEvents ?? 0,
      listingViewers: views?.uniqueViewers ?? 0,
    },
    ads,
    monthlyHistory,
    runRate: buildRunRate(
      period.periodDays,
      commerce.gmv.current,
      commerce.orders.current,
      growth.newUsers.current,
      monthlyHistory,
    ),
    priorBriefings,
  }
}
