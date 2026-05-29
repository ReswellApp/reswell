import { AdminOverviewView } from '@/components/features/admin/admin-overview-view'
import { fetchAdminOverviewSnapshot } from '@/lib/db/adminOverview'
import { loadAdminPlatformPurchaseFees } from '@/lib/services/adminPlatformFees'
import { loadAdminBusinessInsights } from '@/lib/services/adminBusinessInsights'
import { privatePageMetadata } from '@/lib/site-metadata'
import { createClient } from '@/lib/supabase/server'

export const metadata = privatePageMetadata({
  title: 'Admin overview — Reswell',
  description: 'Operations dashboard: marketplace pulse, support queues, and recent activity.',
  path: '/admin',
})

export default async function AdminDashboard() {
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
    ? loadAdminBusinessInsights()
    : Promise.resolve(null)

  const [snapshot, feesResult, insightsResult] = await Promise.all([
    fetchAdminOverviewSnapshot(supabase, { includeBrandRequestQueries: isAdmin }),
    feesPromise,
    insightsPromise,
  ])

  const platformFees = feesResult && feesResult.ok ? feesResult.data : null
  const platformFeesError =
    isAdmin && feesResult && !feesResult.ok ? feesResult.error : null

  const insights = insightsResult && insightsResult.ok ? insightsResult.data : null
  const insightsError =
    isAdmin && insightsResult && !insightsResult.ok ? insightsResult.error : null

  return (
    <AdminOverviewView
      snapshot={snapshot}
      isAdmin={isAdmin}
      platformFees={platformFees}
      platformFeesError={platformFeesError}
      insights={insights}
      insightsError={insightsError}
    />
  )
}
