import { Suspense } from 'react'
import type { AdminNavBadgeCounts } from '@/lib/admin-nav-badge-counts'
import { AdminHomeCountChart } from '@/components/features/admin/admin-home-count-chart'
import { AdminHomeGreeting } from '@/components/features/admin/admin-home-greeting'
import { AdminHomeHeroTiles } from '@/components/features/admin/admin-home-hero-tiles'
import { AdminHomeInsightsKpis } from '@/components/features/admin/admin-home-insights-kpis'
import { AdminMonthlyRevenueTable } from '@/components/features/admin/admin-monthly-revenue-table'
import { AdminHomeRevenueFilter } from '@/components/features/admin/admin-home-revenue-filter'
import { AdminHomeSideRail } from '@/components/features/admin/admin-home-side-rail'
import { AdminRevenueChart } from '@/components/features/admin/admin-revenue-chart'
import type { AdminHomePulse } from '@/lib/services/adminHomePulse'
import type { AdminHomeCountTrend } from '@/lib/services/adminHomeGrowth'
import type {
  AdminBusinessInsights,
  AdminMonthlyRevenueRow,
  AdminRevenueTrend,
} from '@/lib/types/adminBusinessInsights'
import type { AdminHomeRevenueRange } from '@/lib/utils/adminInsightsPeriod'
import { BUSINESS_TIMEZONE_LABEL } from '@/lib/utils/business-timezone'

function revenueChartSubtitle(trend: AdminRevenueTrend): string {
  if (trend.periodMode === 'month') {
    return `Daily GMS and platform revenue in ${trend.periodLabel} (${BUSINESS_TIMEZONE_LABEL})`
  }
  if (trend.aggregation === 'month') {
    return `${trend.periodLabel} · monthly GMS and platform revenue (${BUSINESS_TIMEZONE_LABEL})`
  }
  return `Daily GMS and platform revenue over the last ${trend.periodDays} days (${BUSINESS_TIMEZONE_LABEL})`
}

function countChartSubtitle(trend: AdminHomeCountTrend, noun: string): string {
  const grain = trend.aggregation === 'month' ? 'monthly' : 'daily'
  return `${trend.periodLabel} · ${grain} ${noun} (${BUSINESS_TIMEZONE_LABEL})`
}

interface AdminHomeDashboardProps {
  badgeCounts?: AdminNavBadgeCounts
  displayName?: string | null
  revenueTrend?: AdminRevenueTrend | null
  revenueTrendError?: string | null
  selectedYearMonth?: string | null
  range?: AdminHomeRevenueRange
  pulse?: AdminHomePulse | null
  insights?: AdminBusinessInsights | null
  insightsError?: string | null
  monthlyRevenue?: AdminMonthlyRevenueRow[] | null
  monthlyRevenueError?: string | null
  listingTrend?: AdminHomeCountTrend | null
  userTrend?: AdminHomeCountTrend | null
  growthTrendError?: string | null
  isAdmin?: boolean
}

export function AdminHomeDashboard({
  badgeCounts = {},
  displayName,
  revenueTrend = null,
  revenueTrendError = null,
  selectedYearMonth = null,
  range = 'ytd',
  pulse = null,
  insights = null,
  insightsError = null,
  monthlyRevenue = null,
  monthlyRevenueError = null,
  listingTrend = null,
  userTrend = null,
  growthTrendError = null,
  isAdmin = false,
}: AdminHomeDashboardProps) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Reswell admin
          </p>
          <div className="mt-1 text-foreground">
            <AdminHomeGreeting displayName={displayName} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            GMS, platform revenue, new listings, and new users on one clock.
          </p>
        </div>
        <Suspense fallback={null}>
          <AdminHomeRevenueFilter selectedYearMonth={selectedYearMonth} range={range} />
        </Suspense>
      </header>

      {insights ? (
        <AdminHomeInsightsKpis insights={insights} />
      ) : pulse ? (
        <AdminHomeHeroTiles pulse={pulse} />
      ) : null}
      {insightsError ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">
          {insightsError}
        </p>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {revenueTrendError ? (
            <p className="rounded-xl border border-destructive/40 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">
              {revenueTrendError}
            </p>
          ) : null}
          {revenueTrend ? (
            <AdminRevenueChart
              data={revenueTrend.daily}
              monthly={revenueTrend.monthly}
              chartSubtitle={revenueChartSubtitle(revenueTrend)}
              insight={revenueTrend.insight}
              totalGmv={revenueTrend.totalGmv}
              totalOrders={revenueTrend.totalOrders}
              totalPlatformRevenue={revenueTrend.totalPlatformRevenue}
              layout="hero"
            />
          ) : null}

          {growthTrendError ? (
            <p className="rounded-xl border border-destructive/40 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">
              {growthTrendError}
            </p>
          ) : null}
          {listingTrend || userTrend ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {listingTrend ? (
                <AdminHomeCountChart
                  title="New listings"
                  subtitle={countChartSubtitle(listingTrend, 'new listings')}
                  seriesLabel="New listings"
                  trend={listingTrend}
                  tone="listings"
                />
              ) : null}
              {userTrend ? (
                <AdminHomeCountChart
                  title="New users"
                  subtitle={countChartSubtitle(userTrend, 'new users')}
                  seriesLabel="New users"
                  trend={userTrend}
                  tone="users"
                />
              ) : null}
            </div>
          ) : null}

          {monthlyRevenueError ? (
            <p className="rounded-xl border border-destructive/40 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">
              {monthlyRevenueError}
            </p>
          ) : null}
          {monthlyRevenue ? (
            <AdminMonthlyRevenueTable
              rows={monthlyRevenue}
              selectedYearMonth={selectedYearMonth}
              className="admin-surface border-0"
            />
          ) : null}
        </div>

        <AdminHomeSideRail badgeCounts={badgeCounts} isAdmin={isAdmin} />
      </div>
    </div>
  )
}
