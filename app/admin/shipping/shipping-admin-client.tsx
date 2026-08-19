'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  ExternalLink,
  Loader2,
  Package,
  RefreshCw,
  Scale,
  Ship,
  TrendingUp,
  TriangleAlert,
  Truck,
  Wallet,
  Warehouse,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { AdminShippingStats } from '@/lib/services/adminShippingStats'
import { AdminLabelsCreatedTab } from './admin-labels-created-tab'
import { AdminFailedLabelsTab } from './admin-failed-labels-tab'
import { AdminOrderLabelPurchase } from './admin-order-label-purchase'
import { AdminUserLabelPurchase } from './admin-user-label-purchase'
import { ShippingRateCalculator } from './rate-calculator'
import { ReswellUpsCarrierStatus } from './reswell-ups-carrier-status'
import { ShippingAnalytics } from './shipping-analytics'
import { NavUnreadCountBadge } from '@/components/nav-unread-count-badge'
import { isReswellUpsCarrier } from '@/lib/shipengine/reswell-carriers'

type ApiSlice = { ok: boolean; status: number; data: unknown }

const STAT_ACCENT: Record<'neutral' | 'emerald' | 'amber' | 'sky' | 'violet' | 'rose', string> = {
  neutral: 'bg-secondary text-foreground',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}

function StatTile({
  icon: Icon,
  accent,
  label,
  value,
  hint,
}: {
  icon: LucideIcon
  accent: keyof typeof STAT_ACCENT
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-foreground/15 hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', STAT_ACCENT[accent])}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold leading-none tabular-nums tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function usd(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const tabTriggerClass =
  'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:hover:text-foreground disabled:opacity-40'

type OverviewPayload =
  | {
      configured: false
      message?: string
    }
  | {
      configured: true
      carriers: ApiSlice
      warehouses: ApiSlice
      labels: ApiSlice
    }

const ADDRESS_VALIDATE_PLACEHOLDER = `[
  {
    "name": "Example",
    "address_line1": "500 South Buena Vista Street",
    "city_locality": "Burbank",
    "state_province": "CA",
    "postal_code": "91521",
    "country_code": "US"
  }
]`

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

function carriersList(data: unknown): Record<string, unknown>[] {
  const r = asRecord(data)
  const arr = r?.carriers
  return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : []
}

function warehousesList(data: unknown): Record<string, unknown>[] {
  const r = asRecord(data)
  const arr = r?.warehouses
  return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : []
}

function labelsList(data: unknown): Record<string, unknown>[] {
  const r = asRecord(data)
  const arr = r?.labels
  return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : []
}

function formatCell(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v)
  }
  try {
    return JSON.stringify(v)
  } catch {
    return '…'
  }
}

function JsonPreview({ value }: { value: unknown }) {
  let text: string
  try {
    text = JSON.stringify(value, null, 2)
  } catch {
    text = String(value)
  }
  return (
    <pre className="text-[11px] leading-relaxed bg-black/[0.03] dark:bg-white/[0.04] rounded-2xl border border-border/50 p-4 overflow-x-auto max-h-[min(70vh,520px)] font-mono text-foreground/90 shadow-inner">
      {text}
    </pre>
  )
}

const shipTableShell = 'overflow-hidden rounded-xl border border-border bg-card'
const shipTableHead =
  'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-11'

export function AdminShippingClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const initialTab =
    tabFromUrl === 'failed-labels' ||
    tabFromUrl === 'analytics' ||
    tabFromUrl === 'validate' ||
    tabFromUrl === 'rates' ||
    tabFromUrl === 'create' ||
    tabFromUrl === 'labels-created'
      ? tabFromUrl
      : 'overview'

  const [activeTab, setActiveTab] = useState(initialTab)
  const [failedLabelCount, setFailedLabelCount] = useState(0)
  const [overview, setOverview] = useState<OverviewPayload | null>(null)
  const [stats, setStats] = useState<AdminShippingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const initialLoadDoneRef = useRef(false)

  const [addrJson, setAddrJson] = useState(ADDRESS_VALIDATE_PLACEHOLDER)

  const [addrResult, setAddrResult] = useState<unknown>(null)

  const [addrBusy, setAddrBusy] = useState(false)

  const refreshFailedCount = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shipping/label-failures?limit=1', { credentials: 'include' })
      const body = (await res.json()) as { openCount?: number; total?: number }
      if (res.ok) {
        setFailedLabelCount(body.openCount ?? body.total ?? 0)
      }
    } catch {
      /* ignore — tab fetch will surface errors */
    }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shipping/stats', { credentials: 'include' })
      const body = (await res.json()) as { data?: AdminShippingStats; error?: string }
      if (res.ok && body.data) {
        setStats(body.data)
      }
    } catch {
      /* ignore — analytics tab surfaces its own errors */
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    void refreshFailedCount()
  }, [refreshFailedCount])

  useEffect(() => {
    if (failedLabelCount > 0 && !tabFromUrl) {
      setActiveTab('failed-labels')
    }
  }, [failedLabelCount, tabFromUrl])

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'overview') {
      params.delete('tab')
    } else {
      params.set('tab', value)
    }
    const qs = params.toString()
    router.replace(qs ? `/admin/shipping?${qs}` : '/admin/shipping', { scroll: false })
  }

  const handleFailureQueueChanged = () => {
    void refreshFailedCount()
    void loadStats()
    router.refresh()
  }

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const firstEver = !initialLoadDoneRef.current
    if (firstEver) setLoading(true)
    else if (!opts?.silent) setRefreshing(true)
    try {
      const res = await fetch('/api/admin/shipengine', { credentials: 'include' })
      const body = (await res.json()) as OverviewPayload
      if (!res.ok) {
        toast.error('Could not load ShipEngine overview')
        setOverview(null)
        return
      }
      setOverview(body)
    } catch {
      toast.error('Could not load ShipEngine overview')
      setOverview(null)
    } finally {
      if (firstEver) {
        setLoading(false)
        initialLoadDoneRef.current = true
      } else if (!opts?.silent) {
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function postAction(
    action: 'validate_address',
    rawJson: string,
    setBusy: (b: boolean) => void,
    setResult: (v: unknown) => void,
  ) {
    let payload: unknown
    try {
      payload = JSON.parse(rawJson) as unknown
    } catch {
      toast.error('Invalid JSON — fix syntax and try again')
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/shipengine', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      })
      const data = (await res.json()) as unknown
      setResult(data)
      const payloadOk = asRecord(data)?.ok === true
      if (!res.ok || !payloadOk) {
        toast.error('ShipEngine returned an error (see response below)')
      } else {
        toast.success('Request completed')
      }
    } catch {
      toast.error('Request failed')
    } finally {
      setBusy(false)
    }
  }

  const configured = overview && 'configured' in overview && overview.configured
  const carrierCount = configured && overview.configured && overview.carriers.ok
    ? carriersList(overview.carriers.data).length
    : null
  const warehouseCount = configured && overview.configured && overview.warehouses.ok
    ? warehousesList(overview.warehouses.data).length
    : null

  const handleRefresh = () => {
    void load({ silent: false })
    void loadStats()
    void refreshFailedCount()
  }

  const marginPositive = (stats?.cost.marginUsd ?? 0) >= 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">Shipping</h1>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                configured
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                  : 'border-border bg-card text-muted-foreground',
              )}
            >
              <Ship className="h-3.5 w-3.5" />
              {loading && !overview
                ? 'Connecting…'
                : configured
                  ? 'ShipEngine connected'
                  : 'ShipEngine not configured'}
            </span>
            {failedLabelCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/5 px-2.5 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                <TriangleAlert className="h-3.5 w-3.5" />
                {failedLabelCount} need{failedLabelCount === 1 ? 's' : ''} a label
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Carriers, rates, labels, and fulfillment analytics powered by ShipEngine.{' '}
            <a
              href="https://www.shipengine.com/docs/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground/80 underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              Docs
              <ExternalLink className="h-3 w-3 opacity-70" />
            </a>
          </p>
        </div>
        <Button variant="outline" disabled={loading || refreshing} onClick={handleRefresh}>
          <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          icon={Package}
          accent="sky"
          label="Labels · 30d"
          value={stats ? stats.totals.labelsInWindow.toLocaleString() : '—'}
          hint={stats ? `${stats.totals.labelsAllTime.toLocaleString()} all time` : 'Loading…'}
        />
        <StatTile
          icon={Wallet}
          accent="violet"
          label="Spend · 30d"
          value={stats ? usd(stats.totals.spendInWindowUsd) : '—'}
          hint={stats ? `${stats.cost.labelsWithCost} with cost` : undefined}
        />
        <StatTile
          icon={TrendingUp}
          accent={marginPositive ? 'emerald' : 'rose'}
          label="Margin · 30d"
          value={stats ? usd(stats.cost.marginUsd) : '—'}
          hint={stats ? `${stats.cost.reconciledOrders} reconciled` : undefined}
        />
        <StatTile
          icon={TriangleAlert}
          accent={failedLabelCount > 0 ? 'rose' : 'neutral'}
          label="Open failures"
          value={(stats?.totals.openFailures ?? failedLabelCount).toLocaleString()}
          hint={stats ? `${stats.totals.resolvedFailures} resolved` : undefined}
        />
        <StatTile
          icon={Truck}
          accent="amber"
          label="Carriers"
          value={carrierCount != null ? String(carrierCount) : '—'}
          hint="Connected accounts"
        />
        <StatTile
          icon={Warehouse}
          accent="neutral"
          label="Warehouses"
          value={warehouseCount != null ? String(warehouseCount) : '—'}
          hint="Ship-from locations"
        />
      </div>

      {overview && !overview.configured ? (
        <Alert className="rounded-2xl border-border bg-card">
          <Ship className="h-4 w-4 text-muted-foreground" />
          <AlertTitle className="font-semibold tracking-tight">ShipEngine not configured</AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            {overview.message ?? 'Set SHIPENGINE_API_KEY on the server (see .env.example).'} Analytics and the
            failed-label queue still work from Reswell&apos;s own data.
          </AlertDescription>
        </Alert>
      ) : null}

      {!loading && overview ? (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="flex h-auto w-full flex-wrap items-center justify-start gap-1 rounded-2xl border border-border bg-card p-1.5">
            <TabsTrigger value="analytics" className={tabTriggerClass}>
              <TrendingUp className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="failed-labels" className={tabTriggerClass}>
              <TriangleAlert className="h-4 w-4" />
              Failed labels
              <NavUnreadCountBadge count={failedLabelCount} />
            </TabsTrigger>
            <TabsTrigger value="overview" className={tabTriggerClass} disabled={!configured}>
              <Ship className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="validate" className={tabTriggerClass} disabled={!configured}>
              Validate
            </TabsTrigger>
            <TabsTrigger value="rates" className={tabTriggerClass} disabled={!configured}>
              <Scale className="h-4 w-4" />
              Shipping rates
            </TabsTrigger>
            <TabsTrigger value="create" className={tabTriggerClass} disabled={!configured}>
              Create label
            </TabsTrigger>
            <TabsTrigger value="labels-created" className={tabTriggerClass} disabled={!configured}>
              Labels created
            </TabsTrigger>
          </TabsList>

          <TabsContent value="failed-labels" className="page-enter mt-6">
            <AdminFailedLabelsTab
              onOpenCountChange={(c) => {
                setFailedLabelCount(c)
              }}
              onResolved={handleFailureQueueChanged}
            />
          </TabsContent>

          <TabsContent value="analytics" className="page-enter mt-6">
            <ShippingAnalytics stats={stats} onRefresh={loadStats} />
          </TabsContent>

          {configured && overview.configured ? (
          <>
          <TabsContent value="overview" className="page-enter mt-8 space-y-6">
            <ReswellUpsCarrierStatus
              carriers={carriersList(overview.carriers.data)}
              onOpenRates={() => handleTabChange('rates')}
            />

            <Card className="rounded-2xl border-border bg-card">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="text-lg font-semibold tracking-tight">Carriers</CardTitle>
                <CardDescription className="text-sm">
                  Use <code className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[12px] font-mono">carrier_id</code> in
                  rate and label calls.{' '}
                  <Link
                    href="https://www.shipengine.com/docs/carriers/setup/"
                    className="font-medium text-foreground/75 underline decoration-border underline-offset-4 hover:text-foreground"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Setup guide
                  </Link>
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto pt-2">
                {overview.carriers.ok ? (
                  <div className={shipTableShell}>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-transparent">
                        <TableHead className={shipTableHead}>Name</TableHead>
                        <TableHead className={shipTableHead}>Code</TableHead>
                        <TableHead className={shipTableHead}>Carrier ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {carriersList(overview.carriers.data).map((c, i) => {
                        const reswellUps = isReswellUpsCarrier(c)
                        return (
                        <TableRow
                          key={String(c.carrier_id ?? c.carrier_code ?? i)}
                          className={reswellUps ? 'bg-emerald-500/5' : undefined}
                        >
                          <TableCell className="max-w-[200px] truncate">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{formatCell(c.friendly_name ?? c.nickname ?? c.description)}</span>
                              {reswellUps ? (
                                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                                  Reswell UPS
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>{formatCell(c.carrier_code)}</TableCell>
                          <TableCell className="font-mono text-xs">{formatCell(c.carrier_id)}</TableCell>
                        </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  </div>
                ) : (
                  <JsonPreview value={overview.carriers.data} />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border bg-card">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="text-lg font-semibold tracking-tight">Warehouses</CardTitle>
                <CardDescription className="text-sm">
                  Default ship-from locations in ShipEngine
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto pt-2">
                {overview.warehouses.ok ? (
                  <div className={shipTableShell}>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-transparent">
                        <TableHead className={shipTableHead}>Name</TableHead>
                        <TableHead className={shipTableHead}>Warehouse ID</TableHead>
                        <TableHead className={shipTableHead}>City</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {warehousesList(overview.warehouses.data).map((w, i) => {
                        const origin = asRecord(w.origin_address) ?? asRecord(w.address)
                        return (
                          <TableRow key={String(w.warehouse_id ?? w.name ?? i)}>
                            <TableCell>{formatCell(w.name)}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {formatCell(w.warehouse_id)}
                            </TableCell>
                            <TableCell>{formatCell(origin?.city_locality ?? w.city)}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  </div>
                ) : (
                  <JsonPreview value={overview.warehouses.data} />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border bg-card">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="text-lg font-semibold tracking-tight">Recent labels</CardTitle>
                <CardDescription className="text-sm">
                  Tracking and downloads when available.{' '}
                  <Link
                    href="https://www.shipengine.com/docs/labels/"
                    className="font-medium text-foreground/75 underline decoration-border underline-offset-4 hover:text-foreground"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Labels
                  </Link>
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto pt-2">
                {overview.labels.ok ? (
                  <div className={shipTableShell}>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-transparent">
                        <TableHead className={shipTableHead}>Label ID</TableHead>
                        <TableHead className={shipTableHead}>Tracking</TableHead>
                        <TableHead className={shipTableHead}>Status</TableHead>
                        <TableHead className={shipTableHead}>Created</TableHead>
                        <TableHead className={shipTableHead}>Carrier</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {labelsList(overview.labels.data).map((row, i) => (
                        <TableRow key={String(row.label_id ?? row.tracking_number ?? i)}>
                          <TableCell className="font-mono text-xs max-w-[140px] truncate">
                            {formatCell(row.label_id)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{formatCell(row.tracking_number)}</TableCell>
                          <TableCell>{formatCell(row.status)}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatCell(row.created_at)}
                          </TableCell>
                          <TableCell>{formatCell(row.carrier_code)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                ) : (
                  <JsonPreview value={overview.labels.data} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="validate" className="page-enter mt-6 space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <p className="text-sm text-muted-foreground">
                Validates one or more addresses (JSON array).{' '}
                <Link
                  href="https://www.shipengine.com/docs/addresses/validation/"
                  className="font-medium text-foreground/80 underline decoration-border underline-offset-4 hover:text-foreground"
                  target="_blank"
                  rel="noreferrer"
                >
                  Address validation
                </Link>
              </p>
              <Separator className="my-5 bg-border" />
              <Textarea
                value={addrJson}
                onChange={(e) => setAddrJson(e.target.value)}
                className="min-h-[220px] rounded-xl border-border bg-background font-mono text-[12px] leading-relaxed"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  disabled={addrBusy}
                  onClick={() =>
                    void postAction('validate_address', addrJson, setAddrBusy, setAddrResult)
                  }
                >
                  {addrBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Run validation
                </Button>
              </div>
            </div>
            {addrResult != null ? <JsonPreview value={addrResult} /> : null}
          </TabsContent>

          <TabsContent value="rates" className="page-enter mt-6">
            <ShippingRateCalculator carriers={carriersList(overview.carriers.data)} />
          </TabsContent>

          <TabsContent value="create" className="page-enter mt-6 space-y-6">
            <p className="text-sm text-muted-foreground px-0.5">
              Buy a ShipEngine label to send a Reswell package to a member, or buy a marketplace order label
              from the checkout lane. Buying an order label does not mark the order shipped — the seller still
              ships the package.{' '}
              <Link
                href="https://www.shipengine.com/docs/labels/"
                className="font-medium text-foreground/80 underline decoration-border underline-offset-4 hover:text-foreground"
                target="_blank"
                rel="noreferrer"
              >
                ShipEngine labels
              </Link>
            </p>
            <AdminUserLabelPurchase />
            <div className="space-y-3 pt-2">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Marketplace order label</h2>
              <p className="text-sm text-muted-foreground">
                Uses the listing&apos;s packed dimensions and seller locality from checkout, the buyer&apos;s
                ship-to on the order, and the same cheapest-carrier selection as peer checkout.
              </p>
              <AdminOrderLabelPurchase />
            </div>
          </TabsContent>

          <TabsContent value="labels-created" className="page-enter mt-6">
            <AdminLabelsCreatedTab />
          </TabsContent>
          </>
          ) : (
            <TabsContent value="overview" className="page-enter mt-6">
              <Alert className="rounded-2xl border-border bg-card">
                <Ship className="h-4 w-4 text-muted-foreground" />
                <AlertTitle className="font-semibold tracking-tight">ShipEngine tools unavailable</AlertTitle>
                <AlertDescription className="text-sm text-muted-foreground">
                  Configure SHIPENGINE_API_KEY to use overview, rates, and label tools. Analytics and the failed
                  label queue still work from Reswell&apos;s own data.
                </AlertDescription>
              </Alert>
            </TabsContent>
          )}
        </Tabs>
      ) : null}
    </div>
  )
}
