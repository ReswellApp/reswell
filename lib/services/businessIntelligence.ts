import {
  loadAdminBusinessInsights,
  loadAdminMonthlyRevenueBreakdown,
} from "@/lib/services/adminBusinessInsights"
import { isGoogleAnalyticsConfigured, runGoogleAnalyticsReport } from "@/lib/services/googleAnalytics"
import type {
  IntelligenceLiveDashboard,
  IntelligenceTopPath,
} from "@/lib/types/businessIntelligence"

export type { IntelligenceLiveDashboard } from "@/lib/types/businessIntelligence"

export async function loadIntelligenceDashboard(): Promise<IntelligenceLiveDashboard> {
  const [insightsResult, monthlyResult, topPages] = await Promise.all([
    loadAdminBusinessInsights(),
    loadAdminMonthlyRevenueBreakdown(),
    fetchLiveTopPages(),
  ])

  return {
    generatedAt: new Date().toISOString(),
    insights: insightsResult.ok ? insightsResult.data : null,
    insightsError: insightsResult.ok ? null : insightsResult.error,
    monthlyRevenue: monthlyResult.ok ? monthlyResult.data : [],
    monthlyRevenueError: monthlyResult.ok ? null : monthlyResult.error,
    topPages: topPages.pages,
    topPagesSource: topPages.source,
  }
}

async function fetchLiveTopPages(): Promise<{
  pages: IntelligenceTopPath[]
  source: "ga4" | "none"
}> {
  if (!isGoogleAnalyticsConfigured()) return { pages: [], source: "none" }
  const end = new Date()
  const start = new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)
  const report = await runGoogleAnalyticsReport({
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
    metrics: [{ name: "screenPageViews" }, { name: "sessions" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 12,
  })
  if (!report.ok) return { pages: [], source: "none" }
  return {
    source: "ga4",
    pages: report.rows
      .map((row) => ({
        path: row.dimensionValues[0] ?? "",
        title: row.dimensionValues[1] ?? null,
        views: row.metricValues[0] ?? 0,
        sessions: row.metricValues[1] ?? 0,
      }))
      .filter((row) => row.path.length > 0 && !row.path.startsWith("/admin")),
  }
}
