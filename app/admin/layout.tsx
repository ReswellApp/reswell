import React from "react"
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { AdminGuard } from './AdminGuard'
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  MessageSquare,
  Settings,
  Activity,
  Library,
  ShieldCheck,
} from 'lucide-react'

const adminNavItems = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/live', label: 'Live', icon: Activity },
  { href: '/admin/listings', label: 'Listings', icon: Package },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/claims', label: 'Protection claims', icon: ShieldCheck },
  { href: '/admin/contact-messages', label: 'Contact messages', icon: MessageSquare },
  { href: '/admin/collection-requests', label: 'Collection requests', icon: Library },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

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

  const navItems = isAdmin
    ? adminNavItems
    : adminNavItems.filter((item) => item.href !== '/admin/users' && item.href !== '/admin/settings')

  return (
      <div className="flex-1 container mx-auto py-8 bg-background">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <aside className="w-full md:w-64 flex-shrink-0">
            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                  >
                    <item.icon className="h-4 w-4 mr-3" />
                    {item.label}
                  </Button>
                </Link>
              ))}
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
