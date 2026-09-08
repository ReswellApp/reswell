'use client'

import { useState, Suspense } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { ImpersonationBanner } from '@/components/impersonation-banner'
import { AdminSidebarPanel } from '@/components/features/admin/admin-sidebar-panel'
import type { AdminNavGroupConfig } from '@/lib/admin-nav'
import type { AdminNavBadgeCounts } from '@/lib/admin-nav-badge-counts'
import type { AdminShellUser } from '@/lib/admin/admin-shell-user'
import { cn } from '@/lib/utils'

function isSupportInboxPath(pathname: string): boolean {
  return pathname === '/admin/contact-messages'
}

function isFullBleedAdminPath(pathname: string): boolean {
  return (
    pathname === '/admin/home' ||
    pathname === '/admin/orders' ||
    pathname.startsWith('/admin/users/') ||
    isSupportInboxPath(pathname)
  )
}

interface AdminAppShellProps {
  groups: AdminNavGroupConfig[]
  badgeCounts?: AdminNavBadgeCounts
  user: AdminShellUser
  isAdmin: boolean
  children: React.ReactNode
}

export function AdminAppShell({
  groups,
  badgeCounts = {},
  user,
  isAdmin,
  children,
}: AdminAppShellProps) {
  const pathname = usePathname() ?? ''
  const [mobileOpen, setMobileOpen] = useState(false)
  const fullBleed = isFullBleedAdminPath(pathname)
  const workspace = isSupportInboxPath(pathname)

  return (
    <div className={cn('admin-app flex flex-col', workspace ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
      <Suspense fallback={null}>
        <ImpersonationBanner initialIsAdmin={isAdmin} />
      </Suspense>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden h-full w-[260px] shrink-0 border-r border-border/70 bg-white dark:bg-card lg:flex lg:flex-col">
          <AdminSidebarPanel groups={groups} badgeCounts={badgeCounts} user={user} isAdmin={isAdmin} />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border/70 bg-white px-4 py-3 dark:bg-card lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-4 w-4" />
                <span className="sr-only">Open admin menu</span>
              </Button>
              <SheetContent side="left" className="w-[280px] p-0">
                <SheetTitle className="sr-only">Admin navigation</SheetTitle>
                <AdminSidebarPanel
                  groups={groups}
                  badgeCounts={badgeCounts}
                  user={user}
                  isAdmin={isAdmin}
                  onNavigate={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <p className="font-headline text-sm font-semibold text-foreground">Reswell admin</p>
          </div>

          <main
            className={cn(
              'min-w-0 flex-1',
              workspace
                ? 'flex min-h-0 flex-col overflow-hidden p-0'
                : 'px-4 py-5 sm:px-6 sm:py-6 lg:px-8',
            )}
          >
            <div
              className={cn(
                workspace ? 'flex h-0 min-h-0 flex-1 flex-col overflow-hidden' : !fullBleed && 'admin-panel',
              )}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
