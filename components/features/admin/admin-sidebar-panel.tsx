'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, LogOut, Search, Store } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { AdminSidebarNav } from '@/components/features/admin/admin-sidebar-nav'
import { signOutAndRedirect } from '@/lib/auth/sign-out-and-redirect'
import type { AdminNavGroupConfig } from '@/lib/admin-nav'
import type { AdminNavBadgeCounts } from '@/lib/admin-nav-badge-counts'
import type { AdminShellUser } from '@/lib/admin/admin-shell-user'
import { profileMediaDisplaySrc } from '@/lib/public-media-display-src'

function userInitials(name: string, email: string | null): string {
  const base = (name.trim() || email?.trim() || '?').replace(/@.*/, '')
  const parts = base.split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface AdminSidebarPanelProps {
  groups: AdminNavGroupConfig[]
  badgeCounts?: AdminNavBadgeCounts
  user: AdminShellUser
  isAdmin?: boolean
  onNavigate?: () => void
}

export function AdminSidebarPanel({
  groups,
  badgeCounts = {},
  user,
  isAdmin = false,
  onNavigate,
}: AdminSidebarPanelProps) {
  const pathname = usePathname() ?? ''
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const avatarSrc = profileMediaDisplaySrc(user.avatarUrl)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filteredGroups = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return groups
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(term)),
      }))
      .filter((group) => group.items.length > 0)
  }, [groups, query])

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-12 lg:pt-5">
        <Link href="/admin/home" onClick={onNavigate} className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--admin-teal))] text-white">
            <Store className="h-4 w-4" aria-hidden />
          </span>
          <span className="font-headline text-lg font-bold tracking-tight text-foreground">Reswell</span>
        </Link>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="h-9 rounded-full border-border/80 bg-slate-50 pl-9 pr-14 text-sm dark:bg-muted"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-border bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground dark:bg-card">
            ⌘S
          </kbd>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <AdminSidebarNav
          groups={filteredGroups}
          badgeCounts={badgeCounts}
          pathname={pathname}
          onNavigate={onNavigate}
          forceOpen={query.trim().length > 0}
        />
      </div>

      <div className="border-t border-border/70 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-muted"
            >
              <Avatar className="h-9 w-9">
                {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
                <AvatarFallback className="bg-slate-100 text-[11px] font-semibold text-foreground">
                  {userInitials(user.displayName, user.email)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{user.displayName}</span>
                <span className="block truncate text-xs text-muted-foreground">{user.roleLabel}</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/">View marketplace</Link>
            </DropdownMenuItem>
            {isAdmin ? (
              <DropdownMenuItem asChild>
                <Link href="/admin/settings">Settings</Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOutAndRedirect()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
