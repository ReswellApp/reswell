'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Eye,
  FlaskConical,
  Filter,
  Hash,
  Loader2,
  MoreHorizontal,
  MoreVertical,
  Package,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { AdminPageHeader } from '@/components/features/admin/admin-page-header'
import { AdminStatStrip } from '@/components/features/admin/admin-stat-strip'
import { AdminStatusPill } from '@/components/features/admin/admin-status-pill'
import { listingImageShouldBypassOptimization } from '@/lib/listing-media-proxy-url'
import { capitalizeWords } from '@/lib/listing-labels'
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
  delivery_status: string | null
  tracking_carrier: string | null
  carrier_delivered_at: string | null
  created_at: string
  refunded_at: string | null
  buyer_id: string | null
  seller_id: string
  is_admin_test: boolean
  buyer: PartyLabel | null
  seller: PartyLabel | null
  listing: {
    id: string
    title: string | null
    section: string | null
    imageUrl: string | null
  } | null
}

type SortKey = 'created_at' | 'amount'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE_OPTIONS = [25, 50, 100]

/** Status dropdown stays on the fulfillment queues; payment states live on the top strip / More Filter. */
const PRIMARY_OPEN_FILTERS = new Set(['awaiting_shipping', 'in_transit', 'pickup', 'delivered'])

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

function formatOrderDate(createdAt: string): { display: string; title: string } | null {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return null
  return {
    display: format(date, 'MMM dd, yyyy'),
    title: format(date, 'PPpp'),
  }
}

function formatRangeLabel(from: string, to: string): string {
  const start = from ? format(new Date(`${from}T00:00:00`), 'dd MMM, yyyy') : null
  const end = to ? format(new Date(`${to}T00:00:00`), 'dd MMM, yyyy') : null
  if (start && end) return `${start} to ${end}`
  if (start) return `From ${start}`
  if (end) return `Until ${end}`
  return 'All dates'
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
        <span className="line-clamp-1 max-w-[160px] text-sm font-semibold text-foreground">{name}</span>
        <span className="block text-xs text-muted-foreground">
          {party?.email && party.display_name ? party.email : 'Customer'}
        </span>
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

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [openFilter, setOpenFilter] = useState('none')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [testFilter, setTestFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
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
    if (
      open === 'shipping' ||
      open === 'pickup' ||
      open === 'all' ||
      open === 'awaiting_shipping' ||
      open === 'in_transit' ||
      open === 'delivered'
    ) {
      setOpenFilter(open)
      setStatusFilter('all')
    }
  }, [])

  useEffect(() => {
    setOffset(0)
  }, [search, statusFilter, openFilter, paymentFilter, testFilter, dateFrom, dateTo, sortKey, sortDir, pageSize])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/orders/stats', { credentials: 'include' })
      const body = (await res.json()) as { data?: AdminOrdersDashboardPayload; error?: string }
      if (res.ok && body.data) setDashboard(body.data)
    } catch {
      /* non-fatal — first-strip KPIs stay on last-known values */
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
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
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
  }, [statusFilter, openFilter, paymentFilter, testFilter, dateFrom, dateTo, search, sortKey, sortDir, pageSize, offset])

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
    dateFrom !== '' ||
    dateTo !== '' ||
    search !== ''

  const stats = dashboard?.stats
  const pages = pageItems(currentPage, totalPages)

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Orders List"
        description="Here you can find all of your orders."
        breadcrumbs={[
          { label: 'Home', href: '/admin/home' },
          { label: 'Orders List' },
        ]}
        actions={
          <>
            <Button type="button" className="admin-btn-primary hover:text-white" asChild>
              <Link href="/admin/orders/test-purchase">
                <Plus className="mr-2 h-4 w-4" /> Add Order
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="bg-white">
                  More Actions
                  <MoreHorizontal className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={loading}
                  onClick={() => {
                    void fetchOrders()
                    void fetchStats()
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/orders/terminal">
                    <ShoppingBag className="mr-2 h-4 w-4" /> In-person checkout
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <AdminStatStrip
        items={[
          {
            label: 'Total Orders',
            value: stats ? compactNumber(stats.total) : '—',
            footnote: 'All marketplace orders',
            tone: 'teal',
            active: openFilter === 'none' && statusFilter === 'all',
            onClick: () => {
              setOpenFilter('none')
              setStatusFilter('all')
            },
          },
          {
            label: 'New Orders',
            value: stats ? compactNumber(stats.createdToday) : '—',
            footnote: 'Placed today (Pacific)',
            tone: 'amber',
          },
          {
            label: 'Completed Orders',
            value: stats ? compactNumber(stats.confirmed) : '—',
            footnote: 'Confirmed and paid',
            tone: 'green',
            active: statusFilter === 'confirmed' && openFilter === 'none',
            onClick: () => {
              setOpenFilter('none')
              setStatusFilter('confirmed')
            },
          },
          {
            label: 'Cancelled Orders',
            value: stats ? compactNumber(stats.refunded) : '—',
            footnote:
              stats && stats.refunding > 0
                ? `${compactNumber(stats.refunding)} still refunding`
                : 'Refunded orders',
            tone: 'red',
            active: statusFilter === 'refunded' && openFilter === 'none',
            onClick: () => {
              setOpenFilter('none')
              setStatusFilter('refunded')
            },
          },
        ]}
      />

      <div className="admin-surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/70 p-4 lg:flex-row lg:items-center">
          <SiteSearchBar className="flex-1 lg:min-w-0" onSubmit={(e) => e.preventDefault()}>
            <Input
              placeholder="Search by name, Order ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={cn(siteSearchInputClassName(), 'h-10 rounded-lg')}
            />
          </SiteSearchBar>
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            <Select
              value={PRIMARY_OPEN_FILTERS.has(openFilter) ? openFilter : 'view-all'}
              onValueChange={(v) => {
                if (v === 'view-all') {
                  setOpenFilter('none')
                  setStatusFilter('all')
                  return
                }
                setStatusFilter('all')
                setOpenFilter(v)
              }}
            >
              <SelectTrigger className="h-10 w-[200px] bg-white">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view-all">All Status</SelectItem>
                <SelectItem value="awaiting_shipping">Awaiting shipping</SelectItem>
                <SelectItem value="in_transit">In transit</SelectItem>
                <SelectItem value="pickup">Awaiting pickup</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="h-10 bg-white font-normal">
                  <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                  {formatRangeLabel(dateFrom, dateTo)}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="orders-from">
                    From
                  </label>
                  <Input id="orders-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="orders-to">
                    To
                  </label>
                  <Input id="orders-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setDateFrom('')
                    setDateTo('')
                  }}
                >
                  Clear dates
                </Button>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="h-10 bg-white">
                  <Filter className="mr-2 h-4 w-4" />
                  More Filter
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-3">
                <Select
                  value={openFilter === 'none' ? statusFilter : 'all'}
                  onValueChange={(v) => {
                    setOpenFilter('none')
                    setStatusFilter(v)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Payment status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any payment status</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="refunding">Refunding</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Payment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All payments</SelectItem>
                    <SelectItem value="stripe">Card</SelectItem>
                    <SelectItem value="reswell_bucks">Wallet</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={testFilter} onValueChange={setTestFilter}>
                  <SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at:desc">Newest first</SelectItem>
                    <SelectItem value="created_at:asc">Oldest first</SelectItem>
                    <SelectItem value="amount:desc">Highest amount</SelectItem>
                    <SelectItem value="amount:asc">Lowest amount</SelectItem>
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
              </PopoverContent>
            </Popover>
          </div>
        </div>
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
                  setDateFrom('')
                  setDateTo('')
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
                <TableHead>Product Name</TableHead>
                <TableHead>Customer Name</TableHead>
                <TableHead>
                  <SortHeader label="Order ID" sortKey="created_at" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Amount" sortKey="amount" />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const created = formatOrderDate(r.created_at)
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {r.listing?.imageUrl ? (
                          <Image
                            src={r.listing.imageUrl}
                            alt=""
                            width={40}
                            height={40}
                            unoptimized={listingImageShouldBypassOptimization(r.listing.imageUrl)}
                            className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-muted">
                            <Package className="h-4 w-4" aria-hidden />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="line-clamp-1 text-sm font-semibold text-foreground">
                              {capitalizeWords(r.listing?.title) ||
                                r.seller?.display_name ||
                                r.seller?.email ||
                                'Marketplace order'}
                            </span>
                            {r.is_admin_test ? (
                              <Badge
                                variant="outline"
                                className="gap-1 border-violet-500/30 text-violet-600 dark:text-violet-400"
                              >
                                <FlaskConical className="h-3 w-3" /> Test
                              </Badge>
                            ) : null}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {r.listing?.section
                              ? capitalizeWords(r.listing.section.replace(/_/g, ' '))
                              : `${fulfillmentLabel(r.fulfillment_method)} order`}
                          </span>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <PartyCell party={r.buyer} fallbackId={r.buyer_id} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/orders/${r.id}`} className="group flex flex-col">
                        <span className="font-semibold text-foreground group-hover:underline">
                          {r.order_num ? `#${r.order_num}` : `#${r.id.slice(0, 8)}`}
                        </span>
                        <span className="text-xs text-muted-foreground" title={created?.title}>
                          {created?.display ?? '—'}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold tabular-nums text-foreground">{formatUsd(Number(r.amount))}</p>
                      <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        {r.payment_method === 'reswell_bucks' ? (
                          <Wallet className="h-3 w-3" />
                        ) : (
                          <CreditCard className="h-3 w-3" />
                        )}
                        Paid by {paymentLabel(r.payment_method)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <AdminStatusPill
                        fulfillment={{
                          status: r.status,
                          fulfillment_method: r.fulfillment_method,
                          delivery_status: r.delivery_status,
                          tracking_carrier: r.tracking_carrier,
                          carrier_delivered_at: r.carrier_delivered_at,
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button variant="outline" size="sm" className="h-8 bg-white" asChild>
                          <Link href={`/admin/orders/${r.id}`}>
                            <Eye className="mr-1.5 h-3.5 w-3.5" /> Details
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
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        {!loading && !error && rows.length > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border/70 px-4 py-3 sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              className="h-8 bg-white"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - pageSize))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <div className="flex flex-wrap items-center justify-center gap-1">
              {pages.map((page, index) =>
                page === 'ellipsis' ? (
                  <span key={`e-${index}`} className="px-2 text-xs text-muted-foreground">
                    …
                  </span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setOffset((page - 1) * pageSize)}
                    className={cn(
                      'flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm tabular-nums',
                      page === currentPage
                        ? 'rounded-md bg-[hsl(var(--admin-teal))]/12 font-semibold text-[hsl(var(--admin-teal))]'
                        : 'text-muted-foreground hover:bg-slate-50 hover:text-foreground',
                    )}
                  >
                    {page}
                  </button>
                ),
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 bg-white"
              disabled={offset + pageSize >= total}
              onClick={() => setOffset(offset + pageSize)}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
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
