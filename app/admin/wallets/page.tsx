'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Download,
  ExternalLink,
  Loader2,
  MoreVertical,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { setImpersonation as storeImpersonation } from '@/lib/impersonation'
import type { AdminWalletBalanceListRow } from '@/lib/services/adminWalletBalancesList'

type WalletRow = AdminWalletBalanceListRow

type SortKey =
  | 'totalBalance'
  | 'balance'
  | 'pendingBalance'
  | 'lifetime_earned'
  | 'lifetime_cashed_out'
  | 'inWalletOwed'
  | 'createdAt'
  | 'displayName'
type SortDir = 'asc' | 'desc'
type BalanceFilter = 'all' | 'positive' | 'pending' | 'owed' | 'cashed_out' | 'zero'

const PAGE_SIZE_OPTIONS = [25, 50, 100]
const EPSILON = 0.005

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
  icon: typeof Wallet
  accent: 'neutral' | 'emerald' | 'amber' | 'sky' | 'violet' | 'rose'
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
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
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

export default function AdminWalletsPage() {
  const router = useRouter()
  const [rows, setRows] = useState<WalletRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('totalBalance')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [resetTarget, setResetTarget] = useState<WalletRow | null>(null)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    void fetchBalances()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, balanceFilter, pageSize, sortKey, sortDir])

  async function fetchBalances() {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/wallet-balances', { credentials: 'include' })
      const body = (await res.json()) as { data?: WalletRow[]; error?: string }
      if (!res.ok) {
        throw new Error(body.error || 'Could not load wallet balances')
      }
      setRows(body.data ?? [])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load wallet balances')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  async function actAsUser(row: WalletRow) {
    const displayName = row.displayName || 'User'
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: row.userId, displayName, email: row.email }),
    })
    if (res.ok) {
      storeImpersonation({ userId: row.userId, displayName, email: row.email ?? null })
      toast.success(`Now acting as ${displayName}`)
      router.push('/')
    } else {
      toast.error('Failed to start impersonation')
    }
  }

  async function confirmReset() {
    if (!resetTarget) return
    setResetting(true)
    try {
      const res = await fetch(`/api/admin/users/${resetTarget.userId}/wallet`, {
        method: 'POST',
        credentials: 'include',
      })
      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null
      if (!res.ok) {
        toast.error(body?.error ?? 'Failed to reset wallet')
        return
      }
      setRows((prev) =>
        prev.map((r) =>
          r.userId === resetTarget.userId
            ? {
                ...r,
                balance: 0,
                pendingBalance: 0,
                totalBalance: 0,
                lifetime_earned: 0,
                lifetime_spent: 0,
                lifetime_cashed_out: 0,
                spendableBucks: 0,
                inWalletOwed: 0,
              }
            : r,
        ),
      )
      toast.success(`Wallet reset for ${resetTarget.displayName || 'user'}`)
      setResetTarget(null)
    } catch {
      toast.error('Failed to reset wallet')
    } finally {
      setResetting(false)
    }
  }

  // --- Derived data ------------------------------------------------------

  const stats = useMemo(() => {
    let totalInWallet = 0
    let available = 0
    let pending = 0
    let lifetimeEarned = 0
    let lifetimeCashedOut = 0
    let owed = 0
    let nonZero = 0
    let owedCount = 0
    for (const r of rows) {
      totalInWallet += r.totalBalance
      available += r.balance
      pending += r.pendingBalance
      lifetimeEarned += r.lifetime_earned
      lifetimeCashedOut += r.lifetime_cashed_out
      owed += r.inWalletOwed
      if (r.totalBalance > EPSILON) nonZero += 1
      if (r.inWalletOwed > EPSILON) owedCount += 1
    }
    return { totalInWallet, available, pending, lifetimeEarned, lifetimeCashedOut, owed, nonZero, owedCount }
  }, [rows])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const result = rows.filter((r) => {
      switch (balanceFilter) {
        case 'positive':
          if (r.totalBalance <= EPSILON) return false
          break
        case 'pending':
          if (r.pendingBalance <= EPSILON) return false
          break
        case 'owed':
          if (r.inWalletOwed <= EPSILON) return false
          break
        case 'cashed_out':
          if (r.lifetime_cashed_out <= EPSILON) return false
          break
        case 'zero':
          if (r.totalBalance > EPSILON) return false
          break
        default:
          break
      }
      if (!q) return true
      return (
        (r.email?.toLowerCase().includes(q) ?? false) ||
        (r.displayName?.toLowerCase().includes(q) ?? false)
      )
    })

    const dir = sortDir === 'asc' ? 1 : -1
    result.sort((a, b) => {
      switch (sortKey) {
        case 'balance':
          return (a.balance - b.balance) * dir
        case 'pendingBalance':
          return (a.pendingBalance - b.pendingBalance) * dir
        case 'lifetime_earned':
          return (a.lifetime_earned - b.lifetime_earned) * dir
        case 'lifetime_cashed_out':
          return (a.lifetime_cashed_out - b.lifetime_cashed_out) * dir
        case 'inWalletOwed':
          return (a.inWalletOwed - b.inWalletOwed) * dir
        case 'displayName':
          return (a.displayName ?? '').localeCompare(b.displayName ?? '') * dir
        case 'createdAt':
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
        case 'totalBalance':
        default:
          return (a.totalBalance - b.totalBalance) * dir
      }
    })
    return result
  }, [rows, searchQuery, balanceFilter, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * pageSize
  const pageRows = filtered.slice(pageStart, pageStart + pageSize)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'displayName' ? 'asc' : 'desc')
    }
  }

  function exportCsv() {
    const header = [
      'User',
      'Email',
      'Available',
      'Pending',
      'Total in wallet',
      'Owed',
      'Lifetime earned',
      'Lifetime spent',
      'Lifetime cashed out',
      'Joined',
    ]
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
    const lines = filtered.map((r) =>
      [
        escape(r.displayName ?? ''),
        escape(r.email ?? ''),
        r.balance.toFixed(2),
        r.pendingBalance.toFixed(2),
        r.totalBalance.toFixed(2),
        r.inWalletOwed.toFixed(2),
        r.lifetime_earned.toFixed(2),
        r.lifetime_spent.toFixed(2),
        r.lifetime_cashed_out.toFixed(2),
        escape(format(new Date(r.createdAt), 'yyyy-MM-dd')),
      ].join(','),
    )
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reswell-wallets-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} wallet${filtered.length === 1 ? '' : 's'}`)
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
            <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">Wallets</h1>
            <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
              {loading ? 'Loading…' : `${compactNumber(stats.nonZero)} funded`}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Reconciled Reswell Bucks balances, payouts, and lifetime totals across every account.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading || filtered.length === 0}
            onClick={exportCsv}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => void fetchBalances()}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          icon={Wallet}
          accent="emerald"
          label="In wallets"
          value={compactUsd(stats.totalInWallet)}
          hint={`${compactNumber(stats.nonZero)} funded accounts`}
        />
        <StatTile
          icon={Coins}
          accent="sky"
          label="Available"
          value={compactUsd(stats.available)}
          hint="Spendable now"
        />
        <StatTile
          icon={Clock}
          accent="amber"
          label="Pending"
          value={compactUsd(stats.pending)}
          hint="Clearing soon"
        />
        <StatTile
          icon={TrendingUp}
          accent="violet"
          label="Lifetime earned"
          value={compactUsd(stats.lifetimeEarned)}
        />
        <StatTile
          icon={Banknote}
          accent="neutral"
          label="Cashed out"
          value={compactUsd(stats.lifetimeCashedOut)}
          hint="Lifetime payouts"
        />
        <StatTile
          icon={RotateCcw}
          accent="rose"
          label="Owed"
          value={compactUsd(stats.owed)}
          hint={stats.owedCount > 0 ? `${compactNumber(stats.owedCount)} accounts` : 'None'}
        />
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SiteSearchBar className="flex-1 lg:min-w-0" onSubmit={(e) => e.preventDefault()}>
            <Input
              placeholder="Search by name or email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={siteSearchInputClassName()}
            />
          </SiteSearchBar>
          <div className="grid grid-cols-2 gap-2 sm:flex lg:shrink-0">
            <Select value={balanceFilter} onValueChange={(v) => setBalanceFilter(v as BalanceFilter)}>
              <SelectTrigger className="lg:w-44">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All wallets</SelectItem>
                <SelectItem value="positive">Has balance</SelectItem>
                <SelectItem value="pending">Has pending</SelectItem>
                <SelectItem value="owed">Owes platform</SelectItem>
                <SelectItem value="cashed_out">Cashed out</SelectItem>
                <SelectItem value="zero">Empty wallets</SelectItem>
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
              <SelectTrigger className="lg:w-52">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="totalBalance:desc">Highest balance</SelectItem>
                <SelectItem value="totalBalance:asc">Lowest balance</SelectItem>
                <SelectItem value="pendingBalance:desc">Most pending</SelectItem>
                <SelectItem value="lifetime_earned:desc">Top earners</SelectItem>
                <SelectItem value="lifetime_cashed_out:desc">Most cashed out</SelectItem>
                <SelectItem value="inWalletOwed:desc">Most owed</SelectItem>
                <SelectItem value="createdAt:desc">Newest first</SelectItem>
                <SelectItem value="displayName:asc">Name A → Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {!loading && filtered.length !== rows.length ? (
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            {filtered.length} match{filtered.length === 1 ? '' : 'es'} of {rows.length} wallets
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
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10">
              <Wallet className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            </span>
            <p className="mt-3 font-medium text-foreground">Couldn&apos;t load wallets</p>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void fetchBalances()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Try again
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Wallet className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="mt-3 font-medium text-foreground">No wallets found</p>
            <p className="text-sm text-muted-foreground">
              {rows.length === 0 ? 'No accounts loaded.' : 'Try adjusting your search or filters.'}
            </p>
            {rows.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchQuery('')
                  setBalanceFilter('all')
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
                  <SortHeader label="User" sortKey="displayName" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader label="Available" sortKey="balance" className="ml-auto" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader label="Pending" sortKey="pendingBalance" className="ml-auto" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader label="Total" sortKey="totalBalance" className="ml-auto" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader label="Owed" sortKey="inWalletOwed" className="ml-auto" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader label="Earned" sortKey="lifetime_earned" className="ml-auto" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader label="Cashed out" sortKey="lifetime_cashed_out" className="ml-auto" />
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell>
                    <Link href={`/admin/users/${r.userId}`} className="flex items-center gap-3 group">
                      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-secondary ring-1 ring-border">
                        {r.avatarUrl ? (
                          <Image src={r.avatarUrl} alt="" fill sizes="36px" className="object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-foreground">
                            {userInitials(r.displayName, r.email)}
                          </span>
                        )}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="line-clamp-1 max-w-[200px] font-medium text-foreground group-hover:underline">
                          {r.displayName || 'Unknown'}
                        </span>
                        <span className="line-clamp-1 max-w-[200px] text-xs text-muted-foreground">
                          {r.email ?? '—'}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">
                    {r.balance > EPSILON ? formatUsd(r.balance) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.pendingBalance > EPSILON ? (
                      <span className="text-amber-600 dark:text-amber-400">{formatUsd(r.pendingBalance)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">
                    {r.totalBalance > EPSILON ? (
                      formatUsd(r.totalBalance)
                    ) : (
                      <span className="font-normal text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.inWalletOwed > EPSILON ? (
                      <Badge variant="outline" className="border-rose-500/30 text-rose-600 dark:text-rose-400">
                        {formatUsd(r.inWalletOwed)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.lifetime_earned > EPSILON ? formatUsd(r.lifetime_earned) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.lifetime_cashed_out > EPSILON ? formatUsd(r.lifetime_cashed_out) : '—'}
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
                          <Link href={`/admin/users/${r.userId}`}>
                            <Wallet className="mr-2 h-4 w-4" /> Manage wallet
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void actAsUser(r)}>
                          <ExternalLink className="mr-2 h-4 w-4" /> Act as user
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-rose-600 focus:text-rose-600 dark:text-rose-400"
                          onClick={() => setResetTarget(r)}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" /> Reset wallet to zero
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
        {!loading && !loadError && filtered.length > 0 ? (
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

      {/* Reset wallet confirmation */}
      <Dialog open={resetTarget !== null} onOpenChange={(open) => (!open ? setResetTarget(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset wallet to zero?</DialogTitle>
            <DialogDescription>
              This permanently clears all balances, pending funds, lifetime totals, and wallet activity for{' '}
              <span className="font-medium text-foreground">{resetTarget?.displayName || resetTarget?.email}</span>.
              Orders and listings are not affected. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)} disabled={resetting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmReset()} disabled={resetting}>
              {resetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting…
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" /> Reset wallet
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
