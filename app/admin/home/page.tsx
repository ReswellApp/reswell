import { createClient } from '@/lib/supabase/server'
import { getAdminNavGroupsForUser } from '@/lib/admin-nav'
import { fetchAdminNavBadgeCounts } from '@/lib/db/adminNavCounts'
import { AdminHomeDashboard } from '@/components/features/admin/admin-home-dashboard'
import { loadAdminRevenueTrend } from '@/lib/services/adminBusinessInsights'
import { loadAdminHomePulse } from '@/lib/services/adminHomePulse'
import { loadAdminHomeSignupTrend } from '@/lib/services/adminHomeSignups'
import { parseAdminInsightsPeriodSearch } from '@/lib/utils/adminInsightsPeriod'
import { privatePageMetadata } from '@/lib/site-metadata'

export const metadata = privatePageMetadata({
  title: 'Admin home — Reswell',
  description: 'Jump to any admin dashboard by category.',
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
  const launcherGroups = getAdminNavGroupsForUser(isAdmin)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.href !== '/admin/home'),
    }))
    .filter((group) => group.items.length > 0)

  const [badgeCounts, trendResult, pulseResult, signupResult] = await Promise.all([
    fetchAdminNavBadgeCounts(supabase, {
      includeBrandRequests: isAdmin,
    }),
    isAdmin
      ? loadAdminRevenueTrend({ yearMonth: selectedYearMonth, range })
      : Promise.resolve(null),
    loadAdminHomePulse(),
    loadAdminHomeSignupTrend(),
  ])

  const revenueTrend = trendResult && trendResult.ok ? trendResult.data : null
  const revenueTrendError =
    isAdmin && trendResult && !trendResult.ok ? trendResult.error : null

  const displayName = profile?.display_name?.trim() || null

  return (
    <AdminHomeDashboard
      groups={launcherGroups}
      badgeCounts={badgeCounts}
      displayName={displayName}
      revenueTrend={revenueTrend}
      revenueTrendError={revenueTrendError}
      selectedYearMonth={selectedYearMonth}
      range={range}
      pulse={pulseResult.ok ? pulseResult.data : null}
      signupTrend={signupResult.ok ? signupResult.data : null}
      signupTrendError={signupResult.ok ? null : signupResult.error}
      isAdmin={isAdmin}
    />
  )
}
