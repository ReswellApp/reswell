'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SiteSearchBar, siteSearchInputClassName } from '@/components/site-search-bar'
import { Badge } from '@/components/ui/badge'
import { VerifiedBadge, verifiedSellerBadgeClassName } from '@/components/verified-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ExternalLink,
  Mail,
  MoreVertical,
  Package,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldOff,
  Store,
  UserCog,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { setImpersonation as storeImpersonation } from '@/lib/impersonation'
import { cn } from '@/lib/utils'
import type { AdminUserDirectoryRow } from '@/lib/services/adminUsersDirectory'

type User = AdminUserDirectoryRow

type SortKey =
  | 'created_at'
  | 'last_active_at'
  | 'listings_count'
  | 'sales_count'
  | 'gmv'
  | 'display_name'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE_OPTIONS = [25, 50, 100]
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}

function compactUsd(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  }
  return formatUsd(amount)
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
}

function userInitials(name: string | null, email: string | null): string {
  const base = (name?.trim() || email?.trim() || '?').replace(/@.*/, '')
  const parts = base.split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface StatTileProps {
  icon: typeof Users
  accent: 'neutral' | 'emerald' | 'amber' | 'sky' | 'violet'
  label: string
  value: string
  hint?: string
}

const STAT_ACCENT: Record<StatTileProps['accent'], string> = {
  neutral: 'bg-secondary text-foreground',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
}

function StatTile({ icon: Icon, accent, label, value, hint }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-foreground/15 hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', STAT_ACCENT[accent])}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold leading-none tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [pushingKlaviyoUserId, setPushingKlaviyoUserId] = useState<string | null>(null)
  const [runningInactiveSync, setRunningInactiveSync] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    void fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, roleFilter, pageSize, sortKey, sortDir])

  async function fetchUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' })
      const json = (await res.json()) as {
        data?: { users?: User[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === 'string' ? json.error : 'Failed to load users')
        setUsers([])
        return
      }
      setUsers(json.data?.users ?? [])
    } catch {
      toast.error('Failed to load users')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  async function toggleAdmin(userId: string, currentStatus: boolean) {
    const updates = currentStatus ? { is_admin: false } : { is_admin: true, is_employee: false }
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (!error) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, is_admin: !currentStatus, is_employee: currentStatus ? u.is_employee : false }
            : u,
        ),
      )
      toast.success(currentStatus ? 'Admin access removed' : 'Admin access granted')
    } else {
      toast.error('Failed to update user')
    }
  }

  async function toggleEmployee(userId: string, currentStatus: boolean) {
    const updates = currentStatus ? { is_employee: false } : { is_employee: true, is_admin: false }
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (!error) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, is_employee: !currentStatus, is_admin: currentStatus ? u.is_admin : false }
            : u,
        ),
      )
      toast.success(currentStatus ? 'Employee access removed' : 'Employee access granted')
    } else {
      toast.error('Failed to update user')
    }
  }

  async function toggleReswellSeller(userId: string, currentStatus: boolean) {
    const nextStatus = !currentStatus
    try {
      const res = await fetch('/api/admin/users/reswell-seller', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, grant: nextStatus }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(json?.error ?? 'Failed to update user')
        return
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_reswell_seller: nextStatus } : u)),
      )
      toast.success(
        nextStatus
          ? 'Reswell Seller access granted (0% marketplace fee)'
          : 'Reswell Seller access removed',
      )
    } catch {
      toast.error('Failed to update user')
    }
  }

  async function toggleVerified(userId: string, currentStatus: boolean) {
    const nextVerified = !currentStatus
    const { error } = await supabase
      .from('profiles')
      .update(
        nextVerified
          ? { shop_verified: true, shop_verified_at: new Date().toISOString() }
          : { shop_verified: false, shop_verified_at: null },
      )
      .eq('id', userId)
    if (!error) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, shop_verified: nextVerified } : u)))
      toast.success(nextVerified ? 'Verified seller badge granted' : 'Verified seller badge removed')
    } else {
      toast.error('Failed to update user')
    }
  }

  async function runInactiveSyncForEveryone() {
    setRunningInactiveSync(true)
    try {
      const res = await fetch('/api/admin/klaviyo/inactive-milestones/run', {
        method: 'POST',
        credentials: 'include',
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof payload?.error === 'string' ? payload.error : 'Inactive sync failed')
        return
      }
      const s = payload?.summaries as
        | { milestoneDays: number; eligible: number; emitted: number; failed: number }[]
        | undefined
      if (Array.isArray(s)) {
        const parts = s.map((row) => `${row.milestoneDays}d: ${row.emitted}/${row.eligible} sent`)
        toast.success(`Inactive Klaviyo sync complete — ${parts.join(' · ')}`)
      } else {
        toast.success('Inactive Klaviyo sync finished')
      }
    } catch {
      toast.error('Inactive sync failed')
    } finally {
      setRunningInactiveSync(false)
    }
  }

  async function pushInactiveKlaviyoToUser(
    userId: string,
    strategy: 'highest_pending' | 'all_pending',
  ) {
    setPushingKlaviyoUserId(userId)
    try {
      const res = await fetch('/api/admin/klaviyo/inactive-milestones/push', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, strategy, force: false }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(
          typeof payload?.error === 'string'
            ? payload.error
            : 'Klaviyo push failed — check KLAVIYO_API_KEY & DB migration',
        )
        return
      }
      const reason = typeof payload.skipped_reason === 'string' ? payload.skipped_reason : ''
      const attempted = payload.milestones_attempted as unknown
      const sentArr = payload.sent as
        | { milestone_days?: number; klaviyo_ok?: boolean }[]
        | undefined

      if (reason === 'no_last_active_at') {
        toast.message('No last active time — presence never recorded for this profile')
        return
      }
      if (reason === 'no_eligible_milestone_or_all_recorded') {
        toast.message('Not inactive long enough vs 3 / 15 / 30-day tiers, or already recorded')
        return
      }
      if (reason) toast.message(reason)

      if (Array.isArray(attempted) && attempted.length === 0 && !reason.includes('klaviyo_inactivity')) {
        return
      }

      const okCount = Array.isArray(sentArr) ? sentArr.filter((s) => s.klaviyo_ok).length : 0
      if (okCount > 0) {
        const names = sentArr
          ?.filter((s) => s.klaviyo_ok)
          .map((s) => `${s.milestone_days}d`)
          .join(', ')
        toast.success(`Klaviyo inactive event(s) sent (${names ?? 'ok'})`)
      } else if (Array.isArray(sentArr) && sentArr.length > 0) {
        toast.error('Klaviyo rejected the event — check server logs / API key')
      }
    } catch {
      toast.error('Klaviyo push failed')
    } finally {
      setPushingKlaviyoUserId(null)
    }
  }

  async function actAsUser(user: User) {
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        displayName: user.display_name || 'User',
        email: user.email,
      }),
    })
    if (res.ok) {
      storeImpersonation({
        userId: user.id,
        displayName: user.display_name || 'User',
        email: user.email ?? null,
      })
      toast.success(`Now acting as ${user.display_name || 'this user'}`)
      router.push('/')
    } else {
      toast.error('Failed to start impersonation')
    }
  }

  // --- Derived data ------------------------------------------------------

  const stats = useMemo(() => {
    const now = Date.now()
    let newUsers = 0
    let activeSellers = 0
    let staff = 0
    let reswell = 0
    let verified = 0
    for (const u of users) {
      if (now - new Date(u.created_at).getTime() <= THIRTY_DAYS_MS) newUsers += 1
      if (u.listings_count > 0) activeSellers += 1
      if (u.is_admin || u.is_employee) staff += 1
      if (u.is_reswell_seller) reswell += 1
      if (u.shop_verified) verified += 1
    }
    return { total: users.length, newUsers, activeSellers, staff, reswell, verified }
  }, [users])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const result = users.filter((u) => {
      switch (roleFilter) {
        case 'admin':
          if (!u.is_admin) return false
          break
        case 'employee':
          if (!u.is_employee) return false
          break
        case 'reswell':
          if (!u.is_reswell_seller) return false
          break
        case 'verified':
          if (!u.shop_verified) return false
          break
        case 'seller':
          if (u.listings_count <= 0) return false
          break
        case 'standard':
          if (u.is_admin || u.is_employee || u.is_reswell_seller || u.shop_verified) return false
          break
        default:
          break
      }
      if (!q) return true
      return (
        (u.display_name?.toLowerCase().includes(q) ?? false) ||
        (u.email?.toLowerCase().includes(q) ?? false) ||
        (u.city?.toLowerCase().includes(q) ?? false)
      )
    })

    const dir = sortDir === 'asc' ? 1 : -1
    result.sort((a, b) => {
      switch (sortKey) {
        case 'listings_count':
          return (a.listings_count - b.listings_count) * dir
        case 'sales_count':
          return (a.sales_count - b.sales_count) * dir
        case 'gmv':
          return (a.gmv - b.gmv) * dir
        case 'display_name':
          return (a.display_name ?? '').localeCompare(b.display_name ?? '') * dir
        case 'last_active_at': {
          const at = a.last_active_at ? new Date(a.last_active_at).getTime() : 0
          const bt = b.last_active_at ? new Date(b.last_active_at).getTime() : 0
          return (at - bt) * dir
        }
        case 'created_at':
        default:
          return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
      }
    })
    return result
  }, [users, searchQuery, roleFilter, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * pageSize
  const pageRows = filtered.slice(pageStart, pageStart + pageSize)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'display_name' ? 'asc' : 'desc')
    }
  }

  function SortHeader({ label, sortKey: key, className }: { label: string; sortKey: SortKey; className?: string }) {
    const active = sortKey === key
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={cn(
          'inline-flex items-center gap-1 text-left font-medium transition-colors hover:text-foreground',
          active ? 'text-foreground' : 'text-muted-foreground',
          className,
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </button>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">Users</h1>
            <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
              {loading ? 'Loading…' : `${stats.total} total`}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Search members, manage roles &amp; access, and act on accounts across the marketplace.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={runningInactiveSync}
          onClick={() => void runInactiveSyncForEveryone()}
          className="shrink-0"
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', runningInactiveSync && 'animate-spin')} />
          Run inactive Klaviyo sync
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={Users} accent="neutral" label="Total" value={compactNumber(stats.total)} />
        <StatTile
          icon={UserPlus}
          accent="violet"
          label="New (30d)"
          value={compactNumber(stats.newUsers)}
          hint="Joined recently"
        />
        <StatTile
          icon={Store}
          accent="emerald"
          label="Active sellers"
          value={compactNumber(stats.activeSellers)}
          hint={stats.total > 0 ? `${Math.round((stats.activeSellers / stats.total) * 100)}% of users` : undefined}
        />
        <StatTile icon={ShieldCheck} accent="sky" label="Staff" value={compactNumber(stats.staff)} hint="Admin + employee" />
        <StatTile icon={DollarSign} accent="amber" label="Reswell sellers" value={compactNumber(stats.reswell)} hint="0% fee" />
        <StatTile icon={BadgeCheck} accent="sky" label="Verified" value={compactNumber(stats.verified)} hint="Verified shops" />
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SiteSearchBar className="flex-1 lg:min-w-0" onSubmit={(e) => e.preventDefault()}>
            <Input
              placeholder="Search by name, email, or city…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={siteSearchInputClassName()}
            />
          </SiteSearchBar>
          <div className="grid grid-cols-2 gap-2 sm:flex lg:shrink-0">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="lg:w-44">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="seller">Sellers (has listings)</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="employee">Employees</SelectItem>
                <SelectItem value="reswell">Reswell sellers</SelectItem>
                <SelectItem value="verified">Verified sellers</SelectItem>
                <SelectItem value="standard">Standard users</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={`${sortKey}:${sortDir}`}
              onValueChange={(v) => {
                const [k, d] = v.split(':') as [SortKey, SortDir]
                setSortKey(k)
                setSortDir(d)
              }}
            >
              <SelectTrigger className="lg:w-48">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at:desc">Newest first</SelectItem>
                <SelectItem value="created_at:asc">Oldest first</SelectItem>
                <SelectItem value="last_active_at:desc">Recently active</SelectItem>
                <SelectItem value="listings_count:desc">Most listings</SelectItem>
                <SelectItem value="sales_count:desc">Most sales</SelectItem>
                <SelectItem value="gmv:desc">Top GMV</SelectItem>
                <SelectItem value="display_name:asc">Name A → Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {!loading && filtered.length !== users.length ? (
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            {filtered.length} match{filtered.length === 1 ? '' : 'es'} of {users.length} users
          </p>
        ) : null}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="mt-3 font-medium text-foreground">No users found</p>
            <p className="text-sm text-muted-foreground">
              {users.length === 0 ? 'No users loaded.' : 'Try adjusting your search or filters.'}
            </p>
            {users.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchQuery('')
                  setRoleFilter('all')
                }}
              >
                Reset filters
              </Button>
            ) : null}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>
                  <SortHeader label="User" sortKey="display_name" />
                </TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">
                  <SortHeader label="Listings" sortKey="listings_count" className="ml-auto" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader label="Sales" sortKey="sales_count" className="ml-auto" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader label="GMV" sortKey="gmv" className="ml-auto" />
                </TableHead>
                <TableHead>Role</TableHead>
                <TableHead>
                  <SortHeader label="Joined" sortKey="created_at" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Last active" sortKey="last_active_at" />
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Link href={`/admin/users/${user.id}`} className="flex items-center gap-3 group">
                      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-secondary ring-1 ring-border">
                        {user.avatar_url ? (
                          <Image src={user.avatar_url} alt="" fill sizes="36px" className="object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-foreground">
                            {userInitials(user.display_name, user.email)}
                          </span>
                        )}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="line-clamp-1 max-w-[200px] font-medium text-foreground group-hover:underline">
                          {user.display_name || 'Unknown'}
                        </span>
                        <span className="line-clamp-1 max-w-[200px] text-xs text-muted-foreground">
                          {user.email ?? '—'}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.city || '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {user.listings_count > 0 ? (
                      <span className="text-foreground">
                        {compactNumber(user.listings_count)}
                        <span className="text-muted-foreground"> · {user.active_listings_count} live</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">
                    {user.sales_count > 0 ? compactNumber(user.sales_count) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">
                    {user.gmv > 0 ? compactUsd(user.gmv) : <span className="font-normal text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      {user.is_admin ? (
                        <Badge className="bg-primary text-primary-foreground">Admin</Badge>
                      ) : user.is_employee ? (
                        <Badge variant="secondary">Employee</Badge>
                      ) : (
                        <Badge variant="outline">User</Badge>
                      )}
                      {user.is_reswell_seller ? <Badge variant="secondary">Reswell</Badge> : null}
                      {user.shop_verified ? (
                        <Badge variant="outline" className={verifiedSellerBadgeClassName}>
                          <VerifiedBadge size="sm" className="-ml-0.5 mr-px" />
                          Verified
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.last_active_at ? (
                      <span title={format(new Date(user.last_active_at), 'PPpp')} className="cursor-default">
                        {formatDistanceToNow(new Date(user.last_active_at), { addSuffix: true })}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/users/${user.id}`}>
                            <Users className="mr-2 h-4 w-4" /> View profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => actAsUser(user)}>
                          <ExternalLink className="mr-2 h-4 w-4" /> Act as user
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => toggleAdmin(user.id, user.is_admin)}>
                          {user.is_admin ? (
                            <>
                              <ShieldOff className="mr-2 h-4 w-4" /> Remove Admin
                            </>
                          ) : (
                            <>
                              <Shield className="mr-2 h-4 w-4" /> Make Admin
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleEmployee(user.id, user.is_employee)}>
                          <UserCog className="mr-2 h-4 w-4" />
                          {user.is_employee ? 'Remove Employee' : 'Make Employee'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleReswellSeller(user.id, user.is_reswell_seller)}>
                          <Store className="mr-2 h-4 w-4" />
                          {user.is_reswell_seller ? 'Remove Reswell Seller' : 'Make Reswell Seller'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleVerified(user.id, user.shop_verified)}>
                          {user.shop_verified ? (
                            <>
                              <XCircle className="mr-2 h-4 w-4" /> Remove Verified Badge
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Grant Verified Badge
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={pushingKlaviyoUserId === user.id}
                          onClick={() => void pushInactiveKlaviyoToUser(user.id, 'highest_pending')}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Klaviyo: push inactive milestone
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={pushingKlaviyoUserId === user.id}
                          onClick={() => {
                            if (
                              typeof window !== 'undefined' &&
                              !window.confirm(
                                'Send every inactive tier they qualify for that is not recorded yet (can be multiple emails)?',
                              )
                            ) {
                              return
                            }
                            void pushInactiveKlaviyoToUser(user.id, 'all_pending')
                          }}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Klaviyo: push all pending tiers
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {!loading && filtered.length > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              Showing{' '}
              <span className="font-medium tabular-nums text-foreground">
                {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)}
              </span>{' '}
              of <span className="font-medium tabular-nums text-foreground">{filtered.length}</span>
            </p>
            <div className="flex items-center gap-3">
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-xs tabular-nums text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
