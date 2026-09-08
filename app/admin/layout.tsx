import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminGuard } from './AdminGuard'
import { AdminAppShell } from '@/components/features/admin/admin-app-shell'
import { getAdminNavGroupsForUser } from '@/lib/admin-nav'
import { fetchAdminNavBadgeCounts } from '@/lib/db/adminNavCounts'
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

  const isAdmin = profile?.is_admin === true
  const isEmployee = profile?.is_employee === true
  if (!isAdmin && !isEmployee) {
    redirect('/')
  }

  const navGroups = getAdminNavGroupsForUser(isAdmin)
  const navBadgeCounts = await fetchAdminNavBadgeCounts(supabase, {
    includeBrandRequests: isAdmin,
  })

  const shellUser: AdminShellUser = {
    displayName: profile?.display_name?.trim() || profile?.email?.trim() || 'Admin',
    email: profile?.email ?? user.email ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    roleLabel: isAdmin ? 'Super Admin' : 'Staff',
  }

  return (
    <AdminAppShell groups={navGroups} badgeCounts={navBadgeCounts} user={shellUser} isAdmin={isAdmin}>
      <AdminGuard isAdmin={isAdmin} isEmployee={isEmployee}>
        <Suspense fallback={null}>{children}</Suspense>
      </AdminGuard>
    </AdminAppShell>
  )
}
