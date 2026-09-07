import React from "react"
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminGuard } from './AdminGuard'
import { AdminSidebarNavLazy } from '@/components/features/admin/admin-sidebar-nav-lazy'
import { getAdminNavGroupsForUser } from '@/lib/admin-nav'
import { fetchAdminNavBadgeCounts } from '@/lib/db/adminNavCounts'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?redirect=/admin')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, is_employee')
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

  return (
    <div className="flex-1 bg-slate-100 dark:bg-muted">
      <div className="container mx-auto py-8">
        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          <aside className="w-full shrink-0 md:w-64">
            <nav className="rounded-2xl border border-border/70 bg-card p-2 shadow-sm">
              <AdminSidebarNavLazy groups={navGroups} badgeCounts={navBadgeCounts} />
            </nav>
          </aside>

          <main className="min-w-0 flex-1 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
            <AdminGuard isAdmin={isAdmin} isEmployee={isEmployee}>
              {children}
            </AdminGuard>
          </main>
        </div>
      </div>
    </div>
  )
}
