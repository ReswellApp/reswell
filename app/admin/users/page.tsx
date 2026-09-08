'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SiteSearchBar, siteSearchInputClassName } from '@/components/site-search-bar'
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Loader2,
  MoreHorizontal,
  Mail,
  MessageSquarePlus,
  MoreVertical,
  RefreshCw,
  Shield,
  ShieldOff,
  Store,
  UserCog,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { setImpersonation as storeImpersonation } from '@/lib/impersonation'
import { cn } from '@/lib/utils'
import { AdminPageHeader } from '@/components/features/admin/admin-page-header'
import { AdminStatStrip } from '@/components/features/admin/admin-stat-strip'
import { AdminStatusPill } from '@/components/features/admin/admin-status-pill'
import type { AdminUserDirectoryRow } from '@/lib/services/adminUsersDirectory'
import {
  AdminSendUserMessageDialog,
} from '@/components/features/admin/admin-start-user-conversation-dialog'
import type { AdminMarketplaceProfilePickerRow } from '@/lib/services/adminStartMarketplaceConversation'

type User = AdminUserDirectoryRow

type SortKey =
  | 'created_at'
  | 'listings_count'
  | 'sales_count'
  | 'gmv'
  | 'display_name'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE_OPTIONS = [25, 50, 100]
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

const TOGGLEABLE_COLUMNS = [
  { key: 'location', label: 'Location' },
  { key: 'listings', label: 'Listings' },
  { key: 'sales', label: 'Sales' },
  { key: 'gmv', label: 'GMS' },
  { key: 'role', label: 'Role' },
  { key: 'joined', label: 'Joined' },
] as const

type ColumnKey = (typeof TOGGLEABLE_COLUMNS)[number]['key']
type ColumnVisibility = Record<ColumnKey, boolean>

const DEFAULT_COLUMNS: ColumnVisibility = {
  location: true,
  listings: true,
  sales: true,
  gmv: true,
  role: true,
  joined: true,
}

function csvCell(value: unknown): string {
  const str = value == null ? '' : String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function downloadUsersCsv(rows: User[]): void {
  const header = [
    'id',
    'display_name',
    'email',
    'city',
    'role',
    'reswell_seller',
    'verified',
    'listings',
    'active_listings',
    'draft_listings',
    'sales',
    'gmv',
    'joined',
  ]
  const lines = rows.map((u) =>
    [
      u.id,
      u.display_name ?? '',
      u.email ?? '',
      u.city ?? '',
      u.is_admin ? 'admin' : u.is_employee ? 'employee' : 'user',
      u.is_reswell_seller ? 'yes' : 'no',
      u.shop_verified ? 'yes' : 'no',
      u.listings_count,
      u.active_listings_count,
      u.draft_listings_count,
      u.sales_count,
      u.gmv,
      format(new Date(u.created_at), 'yyyy-MM-dd'),
    ]
      .map(csvCell)
      .join(','),
  )
  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reswell-users-${format(new Date(), 'yyyy-MM-dd')}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function pageItems(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const items: Array<number | 'ellipsis'> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) items.push('ellipsis')
  for (let i = start; i <= end; i += 1) items.push(i)
  if (end < total - 1) items.push('ellipsis')
  items.push(total)
  return items
}

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

function userRoleLabel(user: User): { label: string; tone: 'violet' | 'blue' | 'green' | 'slate' } {
  if (user.is_admin) return { label: 'Admin', tone: 'violet' }
  if (user.is_employee) return { label: 'Employee', tone: 'blue' }
  if (user.listings_count > 0) return { label: 'Seller', tone: 'green' }
  return { label: 'User', tone: 'slate' }
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [columns, setColumns] = useState<ColumnVisibility>(DEFAULT_COLUMNS)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [messageDialogOpen, setMessageDialogOpen] = useState(false)
  const [messageTarget, setMessageTarget] = useState<AdminMarketplaceProfilePickerRow | null>(null)
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
    force = false,
  ) {
    setPushingKlaviyoUserId(userId)
    try {
      const res = await fetch('/api/admin/klaviyo/inactive-milestones/push', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, strategy, force }),
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
      const detail =
        typeof payload.skipped_detail === 'string' ? payload.skipped_detail : ''
      const attempted = payload.milestones_attempted as unknown
      const sentArr = payload.sent as
        | { milestone_days?: number; klaviyo_ok?: boolean; klaviyo_detail?: string }[]
        | undefined

      if (reason === 'no_last_sign_in_at' || reason === 'no_last_active_at') {
        toast.message(detail || 'No sign-in on record — cannot measure inactivity for this user')
        return
      }
      if (reason === 'not_inactive_enough') {
        toast.message(detail || 'Not inactive long enough — need 30+ days since last sign-in')
        return
      }
      if (reason === 'already_sent_this_streak') {
        toast.message(
          detail ||
            'Inactive tier already sent this streak — use “Force resend inactive email” to emit again',
        )
        return
      }
      if (reason === 'marketing_opt_out') {
        toast.message(detail || 'User opted out of marketing emails')
        return
      }
      if (reason === 'no_eligible_milestone_or_all_recorded') {
        toast.message(detail || 'No eligible inactive milestone for this profile')
        return
      }
      if (reason) toast.message(detail ? `${reason}: ${detail}` : reason)

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
        const detail = sentArr[0]?.klaviyo_detail
        toast.error(
          detail
            ? `Klaviyo rejected the event — ${detail.slice(0, 120)}`
            : 'Klaviyo rejected the event — check server logs / API key',
        )
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

  function toggleSelect(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function copyEmails(rows: User[]) {
    const emails = rows.map((u) => u.email).filter((e): e is string => !!e)
    if (emails.length === 0) {
      toast.message('No email addresses in the selection')
      return
    }
    try {
      await navigator.clipboard.writeText(emails.join(', '))
      toast.success(`Copied ${emails.length} email${emails.length === 1 ? '' : 's'}`)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  async function bulkSetVerified(rows: User[], verified: boolean) {
    const targets = rows.filter((u) => u.shop_verified !== verified)
    if (targets.length === 0) {
      toast.message(verified ? 'All selected are already verified' : 'None of the selected are verified')
      return
    }
    setBulkRunning(true)
    try {
      const ids = targets.map((u) => u.id)
      const { error } = await supabase
        .from('profiles')
        .update(
          verified
            ? { shop_verified: true, shop_verified_at: new Date().toISOString() }
            : { shop_verified: false, shop_verified_at: null },
        )
        .in('id', ids)
      if (error) {
        toast.error('Bulk verify update failed')
        return
      }
      const idSet = new Set(ids)
      setUsers((prev) => prev.map((u) => (idSet.has(u.id) ? { ...u, shop_verified: verified } : u)))
      toast.success(
        `${verified ? 'Granted' : 'Removed'} verified badge for ${targets.length} user${
          targets.length === 1 ? '' : 's'
        }`,
      )
    } catch {
      toast.error('Bulk verify update failed')
    } finally {
      setBulkRunning(false)
    }
  }

  async function bulkSetReswell(rows: User[], grant: boolean) {
    const targets = rows.filter((u) => u.is_reswell_seller !== grant)
    if (targets.length === 0) {
      toast.message(grant ? 'All selected are already Reswell sellers' : 'None of the selected are Reswell sellers')
      return
    }
    setBulkRunning(true)
    try {
      const results = await Promise.allSettled(
        targets.map((u) =>
          fetch('/api/admin/users/reswell-seller', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: u.id, grant }),
          }).then((res) => {
            if (!res.ok) throw new Error('failed')
            return u.id
          }),
        ),
      )
      const ok = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - ok
      const okIds = new Set(
        results
          .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
          .map((r) => r.value),
      )
      setUsers((prev) => prev.map((u) => (okIds.has(u.id) ? { ...u, is_reswell_seller: grant } : u)))
      if (ok > 0) {
        toast.success(
          `${grant ? 'Granted' : 'Removed'} Reswell seller for ${ok} user${ok === 1 ? '' : 's'}` +
            (failed > 0 ? ` · ${failed} failed` : ''),
        )
      } else {
        toast.error('Bulk Reswell update failed')
      }
    } catch {
      toast.error('Bulk Reswell update failed')
    } finally {
      setBulkRunning(false)
    }
  }

  // --- Derived data ------------------------------------------------------

  const stats = useMemo(() => {
    const now = Date.now()
    const todayStart = startOfToday()
    let newToday = 0
    let newUsers = 0
    let activeSellers = 0
    let staff = 0
    let reswell = 0
    let verified = 0
    for (const u of users) {
      const createdMs = new Date(u.created_at).getTime()
      if (createdMs >= todayStart) newToday += 1
      if (now - createdMs <= THIRTY_DAYS_MS) newUsers += 1
      if (u.listings_count > 0) activeSellers += 1
      if (u.is_admin || u.is_employee) staff += 1
      if (u.is_reswell_seller) reswell += 1
      if (u.shop_verified) verified += 1
    }
    return { total: users.length, newToday, newUsers, activeSellers, staff, reswell, verified }
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
        case 'new_today':
          if (new Date(u.created_at).getTime() < startOfToday()) return false
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

  const selectedRows = useMemo(
    () => filtered.filter((u) => selectedIds.has(u.id)),
    [filtered, selectedIds],
  )
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((u) => selectedIds.has(u.id))
  const someOnPageSelected = pageRows.some((u) => selectedIds.has(u.id))

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) {
        for (const u of pageRows) next.delete(u.id)
      } else {
        for (const u of pageRows) next.add(u.id)
      }
      return next
    })
  }

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

  const pages = pageItems(currentPage, totalPages)

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Users List"
        description="Search members, manage roles, and act on accounts."
        breadcrumbs={[
          { label: 'Home', href: '/admin/home' },
          { label: 'Users List' },
        ]}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="bg-white"
              disabled={loading || filtered.length === 0}
              onClick={() => downloadUsersCsv(filtered)}
            >
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="bg-white">
                  More Actions
                  <MoreHorizontal className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={loading} onClick={() => void fetchUsers()}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={runningInactiveSync}
                  onClick={() => void runInactiveSyncForEveryone()}
                >
                  <Mail className="mr-2 h-4 w-4" /> Run inactive Klaviyo sync
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <AdminStatStrip
        items={[
          {
            label: 'Total Users',
            value: loading ? '—' : compactNumber(stats.total),
            footnote: 'All marketplace profiles',
            tone: 'teal',
            active: roleFilter === 'all',
            onClick: () => setRoleFilter('all'),
          },
          {
            label: 'New Users',
            value: loading ? '—' : compactNumber(stats.newToday),
            footnote: 'Joined today',
            tone: 'amber',
            active: roleFilter === 'new_today',
            onClick: () => setRoleFilter('new_today'),
          },
          {
            label: 'Active Sellers',
            value: loading ? '—' : compactNumber(stats.activeSellers),
            footnote: 'Have at least one listing',
            tone: 'green',
            active: roleFilter === 'seller',
            onClick: () => setRoleFilter('seller'),
          },
          {
            label: 'Verified',
            value: loading ? '—' : compactNumber(stats.verified),
            footnote: 'Verified shops',
            tone: 'blue',
            active: roleFilter === 'verified',
            onClick: () => setRoleFilter('verified'),
          },
        ]}
      />

      <div className="admin-surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/70 p-4 lg:flex-row lg:items-center">
          <SiteSearchBar className="flex-1 lg:min-w-0" onSubmit={(e) => e.preventDefault()}>
            <Input
              placeholder="Search by name, email, or city…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(siteSearchInputClassName(), 'h-10 rounded-lg')}
            />
          </SiteSearchBar>
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-10 w-[200px] bg-white">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="new_today">Joined today</SelectItem>
                <SelectItem value="seller">Sellers</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="employee">Employees</SelectItem>
                <SelectItem value="reswell">Reswell sellers</SelectItem>
                <SelectItem value="verified">Verified sellers</SelectItem>
                <SelectItem value="standard">Standard users</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="h-10 bg-white">
                  <Filter className="mr-2 h-4 w-4" />
                  More Filter
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-3">
                <Select
                  value={`${sortKey}:${sortDir}`}
                  onValueChange={(v) => {
                    const [k, d] = v.split(':') as [SortKey, SortDir]
                    setSortKey(k)
                    setSortDir(d)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at:desc">Newest first</SelectItem>
                    <SelectItem value="created_at:asc">Oldest first</SelectItem>
                    <SelectItem value="listings_count:desc">Most listings</SelectItem>
                    <SelectItem value="sales_count:desc">Most sales</SelectItem>
                    <SelectItem value="gmv:desc">Top GMS</SelectItem>
                    <SelectItem value="display_name:asc">Name A → Z</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger>
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start">
                      <Columns3 className="mr-2 h-4 w-4" /> Columns
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {TOGGLEABLE_COLUMNS.map((col) => (
                      <DropdownMenuCheckboxItem
                        key={col.key}
                        checked={columns[col.key]}
                        onCheckedChange={(checked) =>
                          setColumns((prev) => ({ ...prev, [col.key]: checked === true }))
                        }
                        onSelect={(e) => e.preventDefault()}
                      >
                        {col.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </PopoverContent>
            </Popover>
          </div>
        </div>
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
          <Table className="[&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleSelectAllOnPage}
                    aria-label="Select all on page"
                  />
                </TableHead>
                <TableHead>
                  <SortHeader label="User" sortKey="display_name" />
                </TableHead>
                {columns.location ? <TableHead className="hidden lg:table-cell">Location</TableHead> : null}
                {columns.listings ? (
                  <TableHead className="hidden text-right sm:table-cell">
                    <SortHeader label="Listings" sortKey="listings_count" className="ml-auto" />
                  </TableHead>
                ) : null}
                {columns.sales ? (
                  <TableHead className="hidden text-right md:table-cell">
                    <SortHeader label="Sales" sortKey="sales_count" className="ml-auto" />
                  </TableHead>
                ) : null}
                {columns.gmv ? (
                  <TableHead className="hidden text-right sm:table-cell">
                    <SortHeader label="GMS" sortKey="gmv" className="ml-auto" />
                  </TableHead>
                ) : null}
                {columns.role ? <TableHead className="hidden lg:table-cell">Role</TableHead> : null}
                {columns.joined ? (
                  <TableHead className="hidden xl:table-cell">
                    <SortHeader label="Joined" sortKey="created_at" />
                  </TableHead>
                ) : null}
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((user) => (
                <TableRow key={user.id} data-state={selectedIds.has(user.id) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(user.id)}
                      onCheckedChange={() => toggleSelect(user.id)}
                      aria-label={`Select ${user.display_name ?? 'user'}`}
                    />
                  </TableCell>
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
                  {columns.location ? (
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {user.city || '—'}
                    </TableCell>
                  ) : null}
                  {columns.listings ? (
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {user.listings_count > 0 ? (
                        <span className="text-foreground">
                          {compactNumber(user.listings_count)}
                          <span className="text-muted-foreground">
                            {user.draft_listings_count > 0
                              ? ` · ${user.draft_listings_count} draft · ${user.active_listings_count} live`
                              : ` · ${user.active_listings_count} live`}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  ) : null}
                  {columns.sales ? (
                    <TableCell className="hidden text-right tabular-nums text-foreground md:table-cell">
                      {user.sales_count > 0 ? compactNumber(user.sales_count) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  ) : null}
                  {columns.gmv ? (
                    <TableCell className="hidden text-right font-semibold tabular-nums text-foreground sm:table-cell">
                      {user.gmv > 0 ? compactUsd(user.gmv) : <span className="font-normal text-muted-foreground">—</span>}
                    </TableCell>
                  ) : null}
                  {columns.role ? (
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap items-center gap-1">
                        <AdminStatusPill
                          label={userRoleLabel(user).label}
                          tone={userRoleLabel(user).tone}
                        />
                        {user.is_reswell_seller ? (
                          <AdminStatusPill label="Reswell" tone="amber" />
                        ) : null}
                        {user.shop_verified ? (
                          <AdminStatusPill label="Verified" tone="blue" />
                        ) : null}
                      </div>
                    </TableCell>
                  ) : null}
                  {columns.joined ? (
                    <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                      {format(new Date(user.created_at), 'MMM d, yyyy')}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="h-8 bg-white" asChild>
                      <Link href={`/admin/users/${user.id}`}>
                        View
                      </Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8 bg-white">
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
                        <DropdownMenuItem
                          onClick={() => {
                            setMessageTarget({
                              id: user.id,
                              display_name: user.display_name,
                              email: user.email,
                              avatar_url: user.avatar_url,
                            })
                            setMessageDialogOpen(true)
                          }}
                        >
                          <MessageSquarePlus className="mr-2 h-4 w-4" /> Send message
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
                          Klaviyo: push 30-day inactive email
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={pushingKlaviyoUserId === user.id}
                          onClick={() => {
                            if (
                              typeof window !== 'undefined' &&
                              !window.confirm(
                                'Force-send the 30-day inactive email to Klaviyo again (bypasses streak dedupe)? Use for testing or if the first send failed.',
                              )
                            ) {
                              return
                            }
                            void pushInactiveKlaviyoToUser(user.id, 'highest_pending', true)
                          }}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Klaviyo: force resend inactive email
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && filtered.length > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border/70 px-4 py-3 sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              className="h-8 bg-white"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <div className="flex flex-wrap items-center justify-center gap-1">
              {pages.map((pageNum, index) =>
                pageNum === 'ellipsis' ? (
                  <span key={`e-${index}`} className="px-2 text-xs text-muted-foreground">
                    …
                  </span>
                ) : (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      'flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm tabular-nums',
                      pageNum === currentPage
                        ? 'rounded-md bg-[hsl(var(--admin-teal))]/12 font-semibold text-[hsl(var(--admin-teal))]'
                        : 'text-muted-foreground hover:bg-slate-50 hover:text-foreground',
                    )}
                  >
                    {pageNum}
                  </button>
                ),
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 bg-white"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>

      {/* Bulk action bar */}
      {selectedRows.length > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-border bg-popover/95 px-3 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-popover/80">
            <div className="flex items-center gap-2 pr-1">
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold tabular-nums text-primary-foreground">
                {selectedRows.length}
              </span>
              <span className="text-sm font-medium text-foreground">selected</span>
            </div>
            <div className="h-5 w-px bg-border" aria-hidden />
            {bulkRunning ? (
              <span className="flex items-center gap-1.5 px-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Working…
              </span>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => void copyEmails(selectedRows)}>
                  <Copy className="mr-1.5 h-4 w-4" /> Copy emails
                </Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => downloadUsersCsv(selectedRows)}>
                  <Download className="mr-1.5 h-4 w-4" /> Export
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8">
                      <UserCog className="mr-1.5 h-4 w-4" /> Roles &amp; badges
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" side="top" className="w-56">
                    <DropdownMenuLabel>Apply to {selectedRows.length} users</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void bulkSetVerified(selectedRows, true)}>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Grant verified badge
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void bulkSetVerified(selectedRows, false)}>
                      <XCircle className="mr-2 h-4 w-4" /> Remove verified badge
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void bulkSetReswell(selectedRows, true)}>
                      <Store className="mr-2 h-4 w-4" /> Make Reswell sellers
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void bulkSetReswell(selectedRows, false)}>
                      <Store className="mr-2 h-4 w-4" /> Remove Reswell sellers
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearSelection} aria-label="Clear selection">
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}

      <AdminSendUserMessageDialog
        open={messageDialogOpen}
        onOpenChange={(open) => {
          setMessageDialogOpen(open)
          if (!open) setMessageTarget(null)
        }}
        defaultTargetUser={messageTarget}
        trigger={null}
      />
    </div>
  )
}
