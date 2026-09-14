'use client'

import { useEffect, useState, Suspense } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { ImpersonationBanner } from '@/components/impersonation-banner'
import { AdminSidebarPanel } from '@/components/features/admin/admin-sidebar-panel'
import { getAdminPageTitle } from '@/lib/admin/admin-page-title'
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
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const fullBleed = isFullBleedAdminPath(pathname)
  const workspace = isSupportInboxPath(pathname)
  const pageTitle = getAdminPageTitle(pathname, groups)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.adminApp = 'true'
    return () => {
      delete root.dataset.adminApp
    }
  }, [])

  useEffect(() => {
    if (workspace) return
    const timer = window.setTimeout(() => {
      router.prefetch('/admin/contact-messages')
    }, 400)
    return () => window.clearTimeout(timer)
  }, [router, workspace])

  return (
    <div className={cn('admin-app flex flex-col', workspace ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
      <Suspense fallback={null}>
        <ImpersonationBanner initialIsAdmin={isAdmin} />
      </Suspense>
      <div className={cn('flex min-h-0 min-w-0 flex-1', workspace && 'overflow-hidden')}>
        <aside className="hidden h-full w-[260px] shrink-0 border-r border-border/70 bg-white dark:bg-card lg:flex lg:flex-col">
          <AdminSidebarPanel groups={groups} badgeCounts={badgeCounts} user={user} isAdmin={isAdmin} />
        </aside>

        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            workspace ? 'overflow-hidden' : 'max-w-full',
          )}
        >
          <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/70 bg-white px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] dark:bg-card lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open admin menu</span>
              </Button>
              <SheetContent
                side="left"
                className="flex h-dvh w-[min(100%,20rem)] flex-col p-0"
              >
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
            <div className="min-w-0 flex-1">
              <p className="truncate font-headline text-sm font-semibold text-foreground">{pageTitle}</p>
              <p className="truncate text-[11px] text-muted-foreground">Reswell admin</p>
            </div>
          </div>

          <main
            className={cn(
              'min-w-0 max-w-full flex-1',
              workspace
                ? 'flex min-h-0 flex-col overflow-hidden p-0'
                : 'overflow-x-clip px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8',
            )}
          >
            <div
              className={cn(
                'min-w-0 max-w-full',
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
