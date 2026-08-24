import type {
  AdminOverviewListingPreview,
  AdminOverviewSupportPreview,
  AdminOverviewUserPreview,
} from '@/lib/db/adminOverview'
import type { AdminInsightsPeriodMode } from '@/lib/utils/adminInsightsPeriod'

export type TrendMetric = {
  current: number
  previous: number
  /** Percentage change vs the prior period. `null` when the prior period was 0. */
  deltaPct: number | null
}

export type AdminInsightsDailyPoint = {
  date: string
  gmv: number
  fees: number
  orders: number
}

export type AdminRevenueMonthlyPoint = {
  yearMonth: string
  label: string
  gmv: number
  fees: number
  orders: number
  gmvDeltaPct: number | null
  ordersDeltaPct: number | null
  isPartial: boolean
  /** e.g. "vs Jul" or "vs Jul 1–24" for month-to-date. */
  compareLabel: string | null
  /** Full-month run-rate when `isPartial`. */
  projectedGmv: number | null
  projectedOrders: number | null
}

export type AdminInsightsTopSeller = {
  id: string
  name: string
  gmv: number
  orders: number
}

export type AdminInsightsBrandRow = {
  brand: string
  gmv: number
  orders: number
}

export type AdminInsightsSectionRow = {
  section: string
  gmv: number
  orders: number
  share: number
}

export type AdminInsightsOrderPreview = {
  id: string
  order_num: string | null
  status: string
  amount: number
  created_at: string
}

export type AdminMonthlyRevenueRow = {
  yearMonth: string
  gmv: number
  platformRevenue: number
  /** Reswell-funded promo discounts (marketing expense). */
  marketingExpense: number
  orders: number
}

export type AdminBusinessInsights = {
  periodMode: AdminInsightsPeriodMode
  periodLabel: string
  comparePeriodLabel: string
  selectedYearMonth: string | null
  periodDays: number
  revenue: {
    /** Buyer-paid order totals (item + shipping, net of promo). */
    gmv: TrendMetric
    /** Buyer-paid item totals only (excludes shipping, still net of promo). */
    gmvWithoutShipping: TrendMetric
    platformRevenue: TrendMetric
    /** Reswell-funded promo discounts (newsletter + admin-issued codes). */
    marketingExpense: TrendMetric
    orders: TrendMetric
    aov: TrendMetric
  }
  /** Platform fee ÷ listing item GMV (seller earnings + fee). Target 7%. */
  takeRatePct: number | null
  /** Refunded ÷ (confirmed + refunded) within the current window, as a percentage. */
  refundRatePct: number
  refundCount: number
  daily: AdminInsightsDailyPoint[]
  growth: {
    newMembers: TrendMetric
    newListings: TrendMetric
    newSupportThreads: TrendMetric
  }
  supply: {
    activeListings: number
    activeSurfboards: number
    soldInPeriod: number
    /** sold(period) ÷ (sold(period) + active surfboards), as a percentage. */
    sellThroughPct: number | null
  }
  topSellers: AdminInsightsTopSeller[]
  topBrands: AdminInsightsBrandRow[]
  sectionMix: AdminInsightsSectionRow[]
  offers: {
    created: TrendMetric
    accepted: number
    /** accepted ÷ resolved offers (accepted + declined + expired), as a percentage. */
    acceptanceRatePct: number | null
  }
  recentOrders: AdminInsightsOrderPreview[]
  /** Listings created in the selected period (newest first). */
  recentListings: AdminOverviewListingPreview[]
  /** Profiles created in the selected period (newest first). */
  recentUsers: AdminOverviewUserPreview[]
  /** Support tickets created in the selected period (newest first). */
  recentSupport: AdminOverviewSupportPreview[]
}

export type LoadAdminBusinessInsightsOptions = {
  /** `YYYY-MM` calendar month (UTC). Omit for the rolling window. */
  yearMonth?: string | null
}

export type LoadAdminRevenueTrendOptions = {
  /** `YYYY-MM` calendar month (UTC). Omit for a rolling window. */
  yearMonth?: string | null
  /** Home chart range. Ignored when `yearMonth` is set. */
  range?: '30d' | '90d' | 'ytd'
}

export type AdminRevenueTrendAggregation = 'day' | 'month'

export type AdminRevenueTrend = {
  periodMode: AdminInsightsPeriodMode
  periodLabel: string
  periodDays: number
  selectedYearMonth: string | null
  aggregation: AdminRevenueTrendAggregation
  daily: AdminInsightsDailyPoint[]
  monthly: AdminRevenueMonthlyPoint[]
  totalGmv: number
  totalOrders: number
  /** Forward-looking pace line for monthly views. */
  insight: string | null
}

export type MomentumFormat = 'count' | 'usd'

export type MomentumComparison = {
  /** Size of the trailing baseline window in days. */
  windowDays: number
  /** Human label, e.g. "vs yesterday" / "vs 7-day avg". */
  label: string
  /** Total over the trailing window (excludes the most recent 24h). */
  windowTotal: number
  /** Average per-day run-rate across the trailing window. */
  baselinePerDay: number
  /** Today vs the trailing per-day baseline, as a percentage. `null` when baseline is 0. */
  deltaPct: number | null
}

export type MomentumMetricKey =
  | 'newUsers'
  | 'newListings'
  | 'paidOrders'
  | 'searches'
  | 'gmv'
  | 'platformRevenue'

export type MomentumMetric = {
  key: MomentumMetricKey
  label: string
  description: string
  format: MomentumFormat
  /** Most recent 24h value. */
  today: number
  comparisons: MomentumComparison[]
}

export type AdminMomentumMatrix = {
  generatedAt: string
  /** Whether search volume could be measured (Elasticsearch configured). */
  searchesTracked: boolean
  windows: number[]
  metrics: MomentumMetric[]
}
