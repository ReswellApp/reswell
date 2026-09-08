import { createClient } from '@/lib/supabase/server'
import { fetchAdminNavBadgeCounts } from '@/lib/db/adminNavCounts'
import { AdminHomeDashboard } from '@/components/features/admin/admin-home-dashboard'
import {
  loadAdminBusinessInsights,
  loadAdminMonthlyRevenueBreakdown,
  loadAdminRevenueTrend,
} from '@/lib/services/adminBusinessInsights'
import { loadAdminHomeGrowthTrends } from '@/lib/services/adminHomeGrowth'
import { loadAdminHomePulse } from '@/lib/services/adminHomePulse'
import { parseAdminInsightsPeriodSearch } from '@/lib/utils/adminInsightsPeriod'
import { privatePageMetadata } from '@/lib/site-metadata'

export const metadata = privatePageMetadata({
  title: 'Admin home — Reswell',
  description: 'GMS, platform revenue, new listings, and new users.',
  path: '/admin/home',
})

type AdminHomePageProps = {
  searchParams: Promise<{ month?: string; range?: string }>
}

export default async function AdminHomePage({ searchParams }: AdminHomePageProps) {
  const { month: monthParam, range: rangeParam } = await searchParams
  const { yearMonth: selectedYearMonth, range } = parseAdminInsightsPeriodSearch({
    month: monthParam,
    range: rangeParam,
  })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('is_admin, display_name')
        .eq('id', user.id)
        .single()
    : { data: null as { is_admin: boolean | null; display_name: string | null } | null }

  const isAdmin = profile?.is_admin === true

  const [badgeCounts, trendResult, pulseResult, growthResult, insightsResult, monthlyResult] =
    await Promise.all([
      fetchAdminNavBadgeCounts(supabase, {
        includeBrandRequests: isAdmin,
      }),
      isAdmin
        ? loadAdminRevenueTrend({ yearMonth: selectedYearMonth, range })
        : Promise.resolve(null),
      loadAdminHomePulse(),
      isAdmin
        ? loadAdminHomeGrowthTrends({ yearMonth: selectedYearMonth, range })
        : Promise.resolve(null),
      isAdmin
        ? loadAdminBusinessInsights({ yearMonth: selectedYearMonth, range })
        : Promise.resolve(null),
      isAdmin ? loadAdminMonthlyRevenueBreakdown() : Promise.resolve(null),
    ])

  const revenueTrend = trendResult && trendResult.ok ? trendResult.data : null
  const revenueTrendError =
    isAdmin && trendResult && !trendResult.ok ? trendResult.error : null
  const insights = insightsResult && insightsResult.ok ? insightsResult.data : null
  const insightsError =
    isAdmin && insightsResult && !insightsResult.ok ? insightsResult.error : null
  const monthlyRevenue = monthlyResult && monthlyResult.ok ? monthlyResult.data : null
  const monthlyRevenueError =
    isAdmin && monthlyResult && !monthlyResult.ok ? monthlyResult.error : null

  const displayName = profile?.display_name?.trim() || null

  return (
    <AdminHomeDashboard
      badgeCounts={badgeCounts}
      displayName={displayName}
      revenueTrend={revenueTrend}
      revenueTrendError={revenueTrendError}
      selectedYearMonth={selectedYearMonth}
      range={range}
      pulse={pulseResult.ok ? pulseResult.data : null}
      insights={insights}
      insightsError={insightsError}
      monthlyRevenue={monthlyRevenue}
      monthlyRevenueError={monthlyRevenueError}
      listingTrend={growthResult && growthResult.ok ? growthResult.data.listings : null}
      userTrend={growthResult && growthResult.ok ? growthResult.data.users : null}
      growthTrendError={
        isAdmin && growthResult && !growthResult.ok ? growthResult.error : null
      }
      isAdmin={isAdmin}
    />
  )
}
