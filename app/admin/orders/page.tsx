'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Eye,
  FlaskConical,
  Hash,
  Loader2,
  MoreVertical,
  Package,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Trash2,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { AdminOrdersDashboard } from '@/components/features/admin/admin-orders-dashboard'
import { AdminOpenOrdersSection } from '@/components/features/admin/admin-open-orders-section'
import { profileMediaDisplaySrc } from '@/lib/public-media-display-src'
import type { AdminOrdersDashboardPayload } from '@/lib/services/adminOrdersStats'
import { cn } from '@/lib/utils'

type PartyLabel = { display_name: string | null; email: string | null; avatar_url: string | null }

type OrderRow = {
  id: string
  order_num: string | null
  status: string
  amount: number | string
  payment_method: string
  fulfillment_method: string | null
  created_at: string
  refunded_at: string | null
  buyer_id: string | null
  seller_id: string
  is_admin_test: boolean
  buyer: PartyLabel | null
  seller: PartyLabel | null
}

type SortKey = 'created_at' | 'amount'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE_OPTIONS = [25, 50, 100]

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatOrderDate(createdAt: string): { relative: string; title: string } | null {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return null
  return {
    relative: formatDistanceToNow(date, { addSuffix: true }),
    title: format(date, 'PPpp'),
  }
}

function userInitials(name: string | null, email: string | null): string {
  const base = (name?.trim() || email?.trim() || '?').replace(/@.*/, '')
  const parts = base.split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function paymentLabel(method: string): string {
  if (method === 'stripe') return 'Card'
  if (method === 'reswell_bucks') return 'Wallet'
  return method
}

function fulfillmentLabel(method: string | null): string {
  if (!method) return '—'
  return method.charAt(0).toUpperCase() + method.slice(1)
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'confirmed':
      return (
        <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" /> Confirmed
        </Badge>
      )
    case 'refunding':
      return (
        <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400">
          <RotateCcw className="h-3 w-3" /> Refunding
        </Badge>
      )
    case 'refunded':
      return (
        <Badge variant="outline" className="gap-1 border-rose-500/30 text-rose-600 dark:text-rose-400">
          <RotateCcw className="h-3 w-3" /> Refunded
        </Badge>
      )
    case 'pending':
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" /> Pending
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function PartyCell({
  party,
  fallbackId,
  guestLabel = 'Walk-in customer',
}: {
  party: PartyLabel | null
  fallbackId: string | null
  guestLabel?: string
}) {
  const idHint = fallbackId?.slice(0, 8)
  const name =
    party?.display_name ||
    party?.email ||
    (idHint ? `User ${idHint}` : guestLabel)
  const avatarSrc = profileMediaDisplaySrc(party?.avatar_url)
  const initials = userInitials(party?.display_name ?? null, party?.email ?? null)
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-7 w-7 ring-1 ring-border">
        {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
        <AvatarFallback className="bg-secondary text-[10px] font-semibold text-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="line-clamp-1 max-w-[150px] text-sm text-foreground">{name}</span>
      </span>
    </div>
  )
}

export default function AdminOrdersPage() {
  const [rows, setRows] = useState<OrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<AdminOrdersDashboardPayload | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [openFilter, setOpenFilter] = useState('none')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [testFilter, setTestFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [pageSize, setPageSize] = useState(50)
  const [offset, setOffset] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<OrderRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Debounce search input into the query trigger.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    const open = new URLSearchParams(window.location.search).get('open')
    if (open === 'shipping' || open === 'pickup' || open === 'all') {
      setOpenFilter(open)
      setStatusFilter('all')
    }
  }, [])

  useEffect(() => {
    setOffset(0)
  }, [search, statusFilter, openFilter, paymentFilter, testFilter, sortKey, sortDir, pageSize])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await fetch('/api/admin/orders/stats', { credentials: 'include' })
      const body = (await res.json()) as { data?: AdminOrdersDashboardPayload; error?: string }
      if (res.ok && body.data) setDashboard(body.data)
    } catch {
      /* non-fatal — dashboard stays in loading / last-known state */
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (openFilter !== 'none') params.set('open', openFilter)
      else if (statusFilter !== 'all') params.set('status', statusFilter)
      if (paymentFilter !== 'all') params.set('payment', paymentFilter)
      if (testFilter !== 'all') params.set('test', testFilter)
      if (search) params.set('q', search)
      params.set('sort', sortKey)
      params.set('dir', sortDir)
      params.set('limit', String(pageSize))
      params.set('offset', String(offset))

      const res = await fetch(`/api/admin/orders?${params}`, { credentials: 'include' })
      const body = (await res.json()) as { data?: OrderRow[]; total?: number; error?: string }
      if (!res.ok) {
        throw new Error(body.error || 'Could not load orders')
      }
      setRows(body.data ?? [])
      setTotal(body.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load orders')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, openFilter, paymentFilter, testFilter, search, sortKey, sortDir, pageSize, offset])

  useEffect(() => {
    void fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.floor(offset / pageSize) + 1

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
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

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Could not copy')
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/orders/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(body?.error ?? 'Could not delete order')
        return
      }
      const label = deleteTarget.order_num ?? `#${deleteTarget.id.slice(0, 8)}`
      setDeleteTarget(null)
      toast.success(`Test order ${label} deleted`)
      void fetchOrders()
      void fetchStats()
    } catch {
      toast.error('Could not delete order')
    } finally {
      setDeleting(false)
    }
  }

  const hasFilters =
    statusFilter !== 'all' ||
    openFilter !== 'none' ||
    paymentFilter !== 'all' ||
    testFilter !== 'all' ||
    search !== ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">Orders</h1>
            <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
              {dashboard
                ? `${compactNumber(dashboard.stats.total)} total`
                : 'Loading…'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Track open fulfillment, payments, and refunds. Open an order to refund, ship, or cancel.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/orders/test-purchase">
              <ShoppingBag className="mr-2 h-4 w-4" /> Test purchase
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => {
              void fetchOrders()
              void fetchStats()
            }}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <AdminOrdersDashboard data={dashboard} loading={statsLoading} />

      <AdminOpenOrdersSection
        shipping={dashboard?.openLists.shipping ?? []}
        pickup={dashboard?.openLists.pickup ?? []}
        loading={statsLoading}
      />

      {/* Toolbar */}
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SiteSearchBar className="flex-1 lg:min-w-0" onSubmit={(e) => e.preventDefault()}>
            <Input
              placeholder="Search by order # or paste an order ID…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={siteSearchInputClassName()}
            />
          </SiteSearchBar>
          <div className="grid grid-cols-2 gap-2 sm:flex lg:shrink-0">
            <Select
              value={openFilter}
              onValueChange={(v) => {
                setOpenFilter(v)
                if (v !== 'none') setStatusFilter('all')
              }}
            >
              <SelectTrigger className="lg:w-44">
                <SelectValue placeholder="Fulfillment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All fulfillment</SelectItem>
                <SelectItem value="shipping">Open shipping</SelectItem>
                <SelectItem value="pickup">Open pickup</SelectItem>
                <SelectItem value="all">All open</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v)
                if (v !== 'all') setOpenFilter('none')
              }}
            >
              <SelectTrigger className="lg:w-44">
                <SelectValue placeholder="Payment status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payment statuses</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending payment</SelectItem>
                <SelectItem value="refunding">Refunding</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="lg:w-36">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payments</SelectItem>
                <SelectItem value="stripe">Card</SelectItem>
                <SelectItem value="reswell_bucks">Wallet</SelectItem>
              </SelectContent>
            </Select>
            <Select value={testFilter} onValueChange={setTestFilter}>
              <SelectTrigger className="lg:w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All orders</SelectItem>
                <SelectItem value="real">Real only</SelectItem>
                <SelectItem value="test">Test only</SelectItem>
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
              <SelectTrigger className="lg:w-44">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at:desc">Newest first</SelectItem>
                <SelectItem value="created_at:asc">Oldest first</SelectItem>
                <SelectItem value="amount:desc">Highest amount</SelectItem>
                <SelectItem value="amount:asc">Lowest amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-7 w-7 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10">
              <ShoppingBag className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            </span>
            <p className="mt-3 font-medium text-foreground">Couldn&apos;t load orders</p>
            <p className="max-w-md text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void fetchOrders()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <ShoppingBag className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="mt-3 font-medium text-foreground">No orders found</p>
            <p className="text-sm text-muted-foreground">
              {hasFilters ? 'Try adjusting your search or filters.' : 'No orders have been placed yet.'}
            </p>
            {hasFilters ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchInput('')
                  setStatusFilter('all')
                  setOpenFilter('none')
                  setPaymentFilter('all')
                  setTestFilter('all')
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
                <TableHead>Order</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead className="text-right">
                  <SortHeader label="Amount" sortKey="amount" className="ml-auto" />
                </TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Fulfillment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <SortHeader label="Date" sortKey="created_at" />
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/orders/${r.id}`} className="group flex flex-col">
                        <span className="font-mono text-sm font-medium text-foreground group-hover:underline">
                          {r.order_num ?? `#${r.id.slice(0, 8)}`}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">{r.id.slice(0, 8)}…</span>
                      </Link>
                      {r.is_admin_test ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-violet-500/30 text-violet-600 dark:text-violet-400"
                        >
                          <FlaskConical className="h-3 w-3" /> Test
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <PartyCell party={r.buyer} fallbackId={r.buyer_id} />
                  </TableCell>
                  <TableCell>
                    <PartyCell party={r.seller} fallbackId={r.seller_id} />
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">
                    {formatUsd(Number(r.amount))}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      {r.payment_method === 'reswell_bucks' ? (
                        <Wallet className="h-3.5 w-3.5" />
                      ) : (
                        <CreditCard className="h-3.5 w-3.5" />
                      )}
                      {paymentLabel(r.payment_method)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.fulfillment_method ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5" />
                        {fulfillmentLabel(r.fulfillment_method)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {(() => {
                      const created = formatOrderDate(r.created_at)
                      if (!created) return '—'
                      return (
                        <span title={created.title} className="cursor-default">
                          {created.relative}
                        </span>
                      )
                    })()}
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
                          <Link href={`/admin/orders/${r.id}`}>
                            <Eye className="mr-2 h-4 w-4" /> View details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => void copy(r.id, 'Order ID')}>
                          <Copy className="mr-2 h-4 w-4" /> Copy order ID
                        </DropdownMenuItem>
                        {r.order_num ? (
                          <DropdownMenuItem onClick={() => void copy(r.order_num as string, 'Order #')}>
                            <Hash className="mr-2 h-4 w-4" /> Copy order #
                          </DropdownMenuItem>
                        ) : null}
                        {r.is_admin_test ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-rose-600 focus:text-rose-600 dark:text-rose-400"
                              onClick={() => setDeleteTarget(r)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete test order
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {!loading && !error && rows.length > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              Showing{' '}
              <span className="font-medium tabular-nums text-foreground">
                {offset + 1}–{Math.min(offset + pageSize, total)}
              </span>{' '}
              of <span className="font-medium tabular-nums text-foreground">{compactNumber(total)}</span>
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
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - pageSize))}
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
                  disabled={offset + pageSize >= total}
                  onClick={() => setOffset(offset + pageSize)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Delete test order confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete test order?</DialogTitle>
            <DialogDescription>
              This permanently removes test order{' '}
              <span className="font-medium text-foreground">
                {deleteTarget?.order_num ?? `#${deleteTarget?.id.slice(0, 8)}`}
              </span>{' '}
              from the records. Only admin-seeded test orders can be deleted — real marketplace orders are never
              affected. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
