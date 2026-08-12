import type { BusinessIntelligenceLlmReport } from "@/lib/validations/businessIntelligence"
import type { BusinessIntelligencePeriodKind } from "@/lib/validations/businessIntelligence"

export type IntelligenceTrend = {
  current: number
  previous: number
  deltaPct: number | null
}

export type IntelligenceDailyPoint = {
  date: string
  gmv: number
  fees: number
  orders: number
}

export type IntelligenceTopPath = {
  path: string
  views: number
  title?: string | null
  sessions?: number
}

export type IntelligenceCommerceSnapshot = {
  gmv: IntelligenceTrend
  platformRevenue: IntelligenceTrend
  orders: IntelligenceTrend
  aov: IntelligenceTrend
  takeRatePct: number | null
  refundRatePct: number
  refundCount: number
  topBrands: { brand: string; gmv: number; orders: number }[]
  sectionMix: { section: string; gmv: number; orders: number; share: number }[]
  daily: IntelligenceDailyPoint[]
}

export type IntelligenceGrowthSnapshot = {
  newUsers: IntelligenceTrend
  newListings: IntelligenceTrend
  activeListings: number
  activeSurfboards: number
  soldInPeriod: number
  sellThroughPct: number | null
  newSupportThreads: IntelligenceTrend
}

export type IntelligenceSearchSnapshot = {
  configured: boolean
  totalSearches: number
  uniqueQueriesApprox: number
  zeroResultEventCount: number
  topQueries: { query: string; count: number }[]
  zeroResultQueries: { query: string; count: number }[]
}

export type IntelligenceFunnelSnapshot = {
  sellPublishAttempts: number
  sellPublishSuccesses: number
  sellSuccessRate: number | null
  browseClicks: number
  listingViewEvents: number
  listingViewers: number
}

export type IntelligenceAdsSnapshot = {
  configured: boolean
  reason?: string
  googleAdsRevenue: number
  metaAdsRevenue: number
  metaReferralRevenue: number
}

export type IntelligenceMonthlyHistoryRow = {
  yearMonth: string
  gmv: number
  platformRevenue: number
  orders: number
  users: number
  listings: number
}

export type IntelligenceRunRateProjection = {
  dailyGmv: number
  dailyOrders: number
  dailyUsers: number
  next7Days: { gmv: number; orders: number; users: number }
  next30Days: { gmv: number; orders: number; users: number }
  next90Days: { gmv: number; orders: number; users: number }
  momGmvDeltaPct: number | null
}

export type IntelligencePriorBriefing = {
  periodKind: BusinessIntelligencePeriodKind
  periodKey: string
  label: string
  executiveSummary: string
  gmv: number
  orders: number
  newUsers: number
}

export type BusinessIntelligenceSnapshot = {
  periodKind: BusinessIntelligencePeriodKind
  periodKey: string
  periodLabel: string
  compareLabel: string
  startDate: string
  endDate: string
  fromIso: string
  toIsoExclusive: string
  periodDays: number
  capturedAt: string
  commerce: IntelligenceCommerceSnapshot
  growth: IntelligenceGrowthSnapshot
  topPagesGa4: IntelligenceTopPath[]
  topPagesFirstParty: IntelligenceTopPath[]
  mostClickedUrl: IntelligenceTopPath | null
  search: IntelligenceSearchSnapshot
  funnel: IntelligenceFunnelSnapshot
  ads: IntelligenceAdsSnapshot
  monthlyHistory: IntelligenceMonthlyHistoryRow[]
  runRate: IntelligenceRunRateProjection
  priorBriefings: IntelligencePriorBriefing[]
}

export type BusinessIntelligenceReportStatus = "generating" | "complete" | "failed" | "empty"

export type BusinessIntelligenceReportRow = {
  id: string
  period_kind: BusinessIntelligencePeriodKind
  period_key: string
  period_start: string
  period_end: string
  generated_at: string
  model: string
  status: BusinessIntelligenceReportStatus
  from_iso: string
  to_iso: string
  snapshot: BusinessIntelligenceSnapshot
  report: BusinessIntelligenceLlmReport | null
  error: string | null
  created_at: string
  updated_at: string
}

export type BusinessIntelligenceReportListItem = {
  id: string
  period_kind: BusinessIntelligencePeriodKind
  period_key: string
  period_start: string
  period_end: string
  generated_at: string
  model: string
  status: BusinessIntelligenceReportStatus
  error: string | null
  executiveSummary: string | null
}
