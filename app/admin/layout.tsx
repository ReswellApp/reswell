import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminGuard } from './AdminGuard'
import { AdminAppShell } from '@/components/features/admin/admin-app-shell'
import { platformAccessForSignedInUser } from '@/lib/account-access/platform-access'
import { EMPLOYEE_NAV_HREFS } from '@/lib/admin/employee-access'
import { getAdminNavGroupsForUser } from '@/lib/admin-nav'
import { getCachedAdminNavBadgeCounts } from '@/lib/cache/admin-nav-badge-counts'
import type { AdminShellUser } from '@/lib/admin/admin-shell-user'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?redirect=/admin')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, is_employee, display_name, email, avatar_url')
    .eq('id', user.id)
    .single()

  // Shop membership never counts. Only this login's own profile flags do.
  const platformAccess = platformAccessForSignedInUser({ profile })
  const isAdmin = platformAccess.isAdmin
  const isEmployee = platformAccess.isEmployee
  if (!isAdmin && !isEmployee) {
    redirect('/')
  }

  const navGroups = getAdminNavGroupsForUser(isAdmin)
  const navBadgeCounts = await getCachedAdminNavBadgeCounts(supabase, {
    includeBrandRequests: isAdmin,
  })
  const shellBadgeCounts = isAdmin
    ? navBadgeCounts
    : Object.fromEntries(
        Object.entries(navBadgeCounts).filter(([href]) => EMPLOYEE_NAV_HREFS.has(href)),
      )

  const shellUser: AdminShellUser = {
    displayName: profile?.display_name?.trim() || profile?.email?.trim() || 'Admin',
    email: profile?.email ?? user.email ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    roleLabel: isAdmin ? 'Super Admin' : 'Employee',
  }

  return (
    <AdminAppShell groups={navGroups} badgeCounts={shellBadgeCounts} user={shellUser} isAdmin={isAdmin}>
      <AdminGuard isAdmin={isAdmin} isEmployee={isEmployee}>
        <Suspense fallback={null}>{children}</Suspense>
      </AdminGuard>
    </AdminAppShell>
  )
}
