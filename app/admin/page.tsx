import { AdminOverviewView } from '@/components/features/admin/admin-overview-view'
import { loadAdminOverviewSnapshot } from '@/lib/services/adminOverviewSnapshot'
import { loadAdminPlatformPurchaseFees } from '@/lib/services/adminPlatformFees'
import {
  loadAdminBusinessInsights,
  loadAdminMomentumMatrix,
  loadAdminMonthlyRevenueBreakdown,
} from '@/lib/services/adminBusinessInsights'
import { adminInsightsYearMonthSchema } from '@/lib/utils/adminInsightsPeriod'
import { privatePageMetadata } from '@/lib/site-metadata'
import { createClient } from '@/lib/supabase/server'

export const metadata = privatePageMetadata({
  title: 'Admin overview — Reswell',
  description: 'Operations dashboard: marketplace pulse, support queues, and recent activity.',
  path: '/admin',
})

type AdminDashboardProps = {
  searchParams: Promise<{ month?: string }>
}

export default async function AdminDashboard({ searchParams }: AdminDashboardProps) {
  const { month: monthParam } = await searchParams
  const parsedMonth = adminInsightsYearMonthSchema.safeParse(monthParam?.trim())
  const selectedYearMonth = parsedMonth.success ? parsedMonth.data : null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: adminProfile } = user
    ? await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    : { data: null as { is_admin: boolean | null } | null }

  const isAdmin = adminProfile?.is_admin === true

  type FeesOutcome = Awaited<ReturnType<typeof loadAdminPlatformPurchaseFees>>
  const feesPromise: Promise<FeesOutcome | null> = isAdmin
    ? loadAdminPlatformPurchaseFees()
    : Promise.resolve(null)

  type InsightsOutcome = Awaited<ReturnType<typeof loadAdminBusinessInsights>>
  const insightsPromise: Promise<InsightsOutcome | null> = isAdmin
    ? loadAdminBusinessInsights({ yearMonth: selectedYearMonth })
    : Promise.resolve(null)

  type MonthlyOutcome = Awaited<ReturnType<typeof loadAdminMonthlyRevenueBreakdown>>
  const monthlyPromise: Promise<MonthlyOutcome | null> = isAdmin
    ? loadAdminMonthlyRevenueBreakdown()
    : Promise.resolve(null)

  type MomentumOutcome = Awaited<ReturnType<typeof loadAdminMomentumMatrix>>
  const momentumPromise: Promise<MomentumOutcome | null> = isAdmin
    ? loadAdminMomentumMatrix()
    : Promise.resolve(null)

  const [snapshot, feesResult, insightsResult, monthlyResult, momentumResult] =
    await Promise.all([
      loadAdminOverviewSnapshot({ includeBrandRequestQueries: isAdmin }),
      feesPromise,
      insightsPromise,
      monthlyPromise,
      momentumPromise,
    ])

  const platformFees = feesResult && feesResult.ok ? feesResult.data : null
  const platformFeesError =
    isAdmin && feesResult && !feesResult.ok ? feesResult.error : null

  const insights = insightsResult && insightsResult.ok ? insightsResult.data : null
  const insightsError =
    isAdmin && insightsResult && !insightsResult.ok ? insightsResult.error : null

  const monthlyRevenue =
    monthlyResult && monthlyResult.ok ? monthlyResult.data : null
  const monthlyRevenueError =
    isAdmin && monthlyResult && !monthlyResult.ok ? monthlyResult.error : null

  const momentum = momentumResult && momentumResult.ok ? momentumResult.data : null
  const momentumError =
    isAdmin && momentumResult && !momentumResult.ok ? momentumResult.error : null

  return (
    <AdminOverviewView
      snapshot={snapshot}
      isAdmin={isAdmin}
      platformFees={platformFees}
      platformFeesError={platformFeesError}
      insights={insights}
      insightsError={insightsError}
      monthlyRevenue={monthlyRevenue}
      monthlyRevenueError={monthlyRevenueError}
      momentum={momentum}
      momentumError={momentumError}
      selectedYearMonth={selectedYearMonth}
    />
  )
}
