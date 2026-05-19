import React from "react"
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminGuard } from './AdminGuard'
import { AdminSidebarNav } from '@/components/features/admin/admin-sidebar-nav'
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
    <div className="flex-1 container mx-auto py-8 bg-background">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <aside className="w-full md:w-64 flex-shrink-0">
            <nav className="space-y-1">
              <AdminSidebarNav groups={navGroups} badgeCounts={navBadgeCounts} />
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            <AdminGuard isAdmin={isAdmin} isEmployee={isEmployee}>
              {children}
            </AdminGuard>
          </main>
        </div>
      </div>
  )
}
