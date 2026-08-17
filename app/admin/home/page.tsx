import { createClient } from '@/lib/supabase/server'
import { getAdminNavGroupsForUser } from '@/lib/admin-nav'
import { fetchAdminNavBadgeCounts } from '@/lib/db/adminNavCounts'
import { AdminHomeDashboard } from '@/components/features/admin/admin-home-dashboard'
import { privatePageMetadata } from '@/lib/site-metadata'

export const metadata = privatePageMetadata({
  title: 'Admin home — Reswell',
  description: 'Jump to any admin dashboard by category.',
  path: '/admin/home',
})

export default async function AdminHomePage() {
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

  const badgeCounts = await fetchAdminNavBadgeCounts(supabase, {
    includeBrandRequests: isAdmin,
  })

  const displayName = profile?.display_name?.trim() || null

  return (
    <AdminHomeDashboard
      groups={launcherGroups}
      badgeCounts={badgeCounts}
      displayName={displayName}
    />
  )
}
