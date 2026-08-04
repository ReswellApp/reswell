'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Bar, BarChart, Cell, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Package,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Tag,
  Truck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer } from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import { deliveryStatusLabel } from '@/lib/order-status'
import { formatOrderNumForCustomer } from '@/lib/order-num-display'
import type {
  AdminOrdersDashboardPayload,
  AdminOrdersDashboardStats,
  AdminOrdersOpsLabelRow,
  AdminOrdersOpsOrderRow,
} from '@/lib/services/adminOrdersStats'

interface AdminOrdersDashboardProps {
  data: AdminOrdersDashboardPayload | null
  loading?: boolean
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function relAge(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return formatDistanceToNow(date, { addSuffix: true })
}

function partyName(party: { display_name: string | null; email: string | null } | null): string {
  return party?.display_name?.trim() || party?.email?.trim() || '—'
}

function failureStageLabel(stage: string | null): string {
  switch (stage) {
    case 'shipengine_not_configured':
      return 'ShipEngine not configured'
    case 'incomplete_address':
      return 'Incomplete address'
    case 'rate_quote':
      return 'Rate quote failed'
    case 'rate_id':
      return 'Missing rate'
    case 'label_purchase':
      return 'Purchase failed'
    case 'attach_label':
      return 'Attach failed'
    default:
      return stage?.replace(/_/g, ' ') || 'Label failed'
  }
}

const STAGE_META: Array<{
  key: keyof AdminOrdersDashboardStats['openByStage']
  label: string
  hint: string
  barClass: string
  icon: typeof Package
}> = [
  {
    key: 'awaiting_shipment',
    label: 'Awaiting shipment',
    hint: 'Paid, not shipped yet',
    barClass: 'bg-amber-500',
    icon: PackageOpen,
  },
  {
    key: 'shipped',
    label: 'In transit',
    hint: 'Shipped to buyer',
    barClass: 'bg-sky-500',
    icon: Truck,
  },
  {
    key: 'pickup_ready',
    label: 'Ready for pickup',
    hint: 'Waiting on buyer',
    barClass: 'bg-violet-500',
    icon: PackageCheck,
  },
]

const AGE_COLORS: Record<string, string> = {
  under_1d: '#10b981',
  '1_3d': '#0ea5e9',
  '3_7d': '#f59e0b',
  '7_14d': '#f97316',
  over_14d: '#f43f5e',
}

interface KpiProps {
  icon: typeof ShoppingBag
  accent: 'neutral' | 'emerald' | 'amber' | 'sky' | 'violet' | 'rose'
  label: string
  value: string
  hint?: string
}

const KPI_ACCENT: Record<KpiProps['accent'], string> = {
  neutral: 'bg-secondary text-foreground',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}

function Kpi({ icon: Icon, accent, label, value, hint }: KpiProps) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3.5 transition-colors hover:border-foreground/15">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', KPI_ACCENT[accent])}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-2.5 text-2xl font-bold leading-none tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-muted', className)} />
}

function DeliveryBadge({ status }: { status: string | null }) {
  const label = status ? deliveryStatusLabel(status) : '—'
  const tone =
    status === 'shipped'
      ? 'border-sky-500/30 text-sky-700 dark:text-sky-400'
      : status === 'pickup_ready'
        ? 'border-violet-500/30 text-violet-700 dark:text-violet-400'
        : status === 'pending'
          ? 'border-amber-500/30 text-amber-700 dark:text-amber-400'
          : 'text-muted-foreground'
  return (
    <Badge variant="outline" className={cn('font-normal', tone)}>
      {label}
    </Badge>
  )
}

function OpenOrderRow({ row }: { row: AdminOrdersOpsOrderRow }) {
  return (
    <Link
      href={`/admin/orders/${row.id}`}
      className="group flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-background/80"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium text-foreground group-hover:underline">
            {formatOrderNumForCustomer(row.order_num, row.id)}
          </span>
          <DeliveryBadge status={row.delivery_status} />
          {row.has_prepared_label ? (
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/30 font-normal text-emerald-700 dark:text-emerald-400"
            >
              <Tag className="h-3 w-3" /> Label
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {row.listing_title || 'Untitled listing'}
          <span className="text-border"> · </span>
          {partyName(row.seller)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-foreground">{formatUsd(row.amount)}</p>
        <p className="text-[11px] tabular-nums text-muted-foreground">{relAge(row.created_at)}</p>
      </div>
    </Link>
  )
}

function OpenLabelRow({ row }: { row: AdminOrdersOpsLabelRow }) {
  const failed = row.kind === 'label_failed'
  return (
    <Link
      href={`/admin/orders/${row.id}`}
      className="group flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-background/80"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium text-foreground group-hover:underline">
            {formatOrderNumForCustomer(row.order_num, row.id)}
          </span>
          {failed ? (
            <Badge
              variant="outline"
              className="gap-1 border-rose-500/30 font-normal text-rose-700 dark:text-rose-400"
            >
              <AlertTriangle className="h-3 w-3" /> Failed
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/30 font-normal text-emerald-700 dark:text-emerald-400"
            >
              <Tag className="h-3 w-3" /> Ready
            </Badge>
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {failed
            ? failureStageLabel(row.failure_stage)
            : row.tracking_number
              ? `${row.tracking_carrier || 'Carrier'} · ${row.tracking_number}`
              : row.listing_title || 'Shipping label ready'}
        </p>
        {!failed && row.listing_title ? (
          <p className="line-clamp-1 text-[11px] text-muted-foreground/80">{row.listing_title}</p>
        ) : null}
        {failed && row.failure_message ? (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-rose-600/80 dark:text-rose-400/80">
            {row.failure_message}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-foreground">{formatUsd(row.amount)}</p>
        <p className="text-[11px] tabular-nums text-muted-foreground">{relAge(row.created_at)}</p>
      </div>
    </Link>
  )
}

export function AdminOrdersDashboard({ data, loading }: AdminOrdersDashboardProps) {
  const stats = data?.stats ?? null
  const queues = data?.queues ?? null

  const refundRate = useMemo(() => {
    if (!stats || stats.total === 0) return 0
    return Math.round(((stats.refunded + stats.refunding) / stats.total) * 100)
  }, [stats])

  const stageMax = useMemo(() => {
    if (!stats) return 1
    return Math.max(1, ...STAGE_META.map((s) => stats.openByStage[s.key]))
  }, [stats])

  const ageData = useMemo(
    () =>
      (stats?.openByAge ?? []).map((row) => ({
        ...row,
        fill: AGE_COLORS[row.key] ?? '#94a3b8',
      })),
    [stats],
  )

  const hasOpenOrders = (stats?.openUnfulfilled ?? 0) > 0
  const labelAttention =
    (stats?.needsLabel ?? 0) + (stats?.openLabels ?? 0) + (stats?.openLabelFailures ?? 0)

  if (loading && !data) {
    return (
      <Card className="rounded-2xl border-border bg-card shadow-none hover:shadow-none">
        <CardHeader className="pb-3">
          <SkeletonBlock className="h-6 w-48" />
          <SkeletonBlock className="mt-2 h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-[88px]" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            <SkeletonBlock className="h-[260px]" />
            <SkeletonBlock className="h-[260px]" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <SkeletonBlock className="h-[280px]" />
            <SkeletonBlock className="h-[280px]" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border-border bg-card shadow-none hover:shadow-none">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Package className="h-5 w-5 text-muted-foreground" aria-hidden />
              Orders command center
            </CardTitle>
            <CardDescription className="mt-1">
              Payment health, open fulfillment, and shipping-label ops in one place.
            </CardDescription>
          </div>
          {labelAttention > 0 ? (
            <Badge
              variant="outline"
              className="gap-1.5 border-amber-500/30 bg-amber-500/5 font-normal text-amber-700 dark:text-amber-400"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {compactNumber(labelAttention)} shipping actions
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            icon={ShoppingBag}
            accent="neutral"
            label="Total orders"
            value={stats ? compactNumber(stats.total) : '—'}
            hint={stats ? `${compactNumber(stats.confirmed)} confirmed` : undefined}
          />
          <Kpi
            icon={PackageOpen}
            accent="amber"
            label="Open unfulfilled"
            value={stats ? compactNumber(stats.openUnfulfilled) : '—'}
            hint="Paid, not delivered / picked up"
          />
          <Kpi
            icon={Tag}
            accent="sky"
            label="Open labels"
            value={stats ? compactNumber(stats.openLabels) : '—'}
            hint="Label ready, not shipped"
          />
          <Kpi
            icon={AlertTriangle}
            accent="rose"
            label="Label failures"
            value={stats ? compactNumber(stats.openLabelFailures) : '—'}
            hint={
              stats && stats.needsLabel > 0
                ? `${compactNumber(stats.needsLabel)} still need a label`
                : 'Automation queue'
            }
          />
          <Kpi
            icon={Clock}
            accent="amber"
            label="Needs label"
            value={stats ? compactNumber(stats.needsLabel) : '—'}
            hint="Awaiting shipment, no tracking"
          />
          <Kpi
            icon={Truck}
            accent="sky"
            label="In transit"
            value={stats ? compactNumber(stats.openByStage.shipped) : '—'}
            hint="Shipped to buyer"
          />
          <Kpi
            icon={RotateCcw}
            accent="rose"
            label="Refunded"
            value={stats ? compactNumber(stats.refunded) : '—'}
            hint={
              stats && stats.refunding > 0
                ? `${compactNumber(stats.refunding)} refunding`
                : undefined
            }
          />
          <Kpi
            icon={RefreshCw}
            accent="violet"
            label="Refund rate"
            value={stats ? `${refundRate}%` : '—'}
            hint="Refunded + refunding"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Open orders by age</p>
                <p className="text-xs text-muted-foreground">
                  Confirmed orders still awaiting delivery or pickup
                </p>
              </div>
              {stats ? (
                <p className="text-xs tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {compactNumber(stats.openUnfulfilled)}
                  </span>{' '}
                  open
                  {stats.openByMethod.shipping + stats.openByMethod.pickup > 0 ? (
                    <>
                      {' '}
                      · {compactNumber(stats.openByMethod.shipping)} ship /{' '}
                      {compactNumber(stats.openByMethod.pickup)} pickup
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>

            {hasOpenOrders ? (
              <ChartContainer
                config={{
                  count: { label: 'Open orders', color: '#0ea5e9' },
                }}
                className="h-[220px] w-full"
              >
                <BarChart data={ageData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={11}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    fontSize={11}
                  />
                  <RechartsTooltip
                    cursor={{ fill: 'var(--muted)', opacity: 0.45 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null
                      const row = payload[0].payload as { label: string; count: number }
                      return (
                        <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                          <p className="font-medium">{row.label}</p>
                          <p className="tabular-nums text-muted-foreground">
                            {row.count} open {row.count === 1 ? 'order' : 'orders'}
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44}>
                    {ageData.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[220px] flex-col items-center justify-center text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10">
                  <PackageCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </span>
                <p className="mt-3 text-sm font-medium text-foreground">No open orders</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Every confirmed marketplace order is delivered or picked up.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="mb-4">
              <p className="text-sm font-semibold text-foreground">Fulfillment stages</p>
              <p className="text-xs text-muted-foreground">Where open orders sit right now</p>
            </div>
            <div className="space-y-3.5">
              {STAGE_META.map((stage) => {
                const count = stats?.openByStage[stage.key] ?? 0
                const width = Math.max(count > 0 ? 10 : 0, Math.round((count / stageMax) * 100))
                const Icon = stage.icon
                return (
                  <div key={stage.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        {stage.label}
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-foreground">
                        {compactNumber(count)}
                      </span>
                    </div>
                    <div className="relative h-8 overflow-hidden rounded-md bg-muted/60">
                      <div
                        className={cn('h-full rounded-md transition-all', stage.barClass)}
                        style={{ width: `${width}%`, opacity: count > 0 ? 0.9 : 0 }}
                      />
                      <span className="absolute inset-y-0 left-2.5 flex items-center text-[11px] text-muted-foreground">
                        {stage.hint}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/70 pt-4">
              <div className="rounded-lg border border-border bg-background/50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Needs label
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                  {stats ? compactNumber(stats.needsLabel) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background/50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Pending payment
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                  {stats ? compactNumber(stats.pending) : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Open orders</p>
                <p className="text-xs text-muted-foreground">Oldest unfulfilled first</p>
              </div>
              <Badge variant="outline" className="tabular-nums font-normal">
                {stats ? compactNumber(stats.openUnfulfilled) : '—'}
              </Badge>
            </div>
            {(queues?.openOrders.length ?? 0) === 0 ? (
              <div className="flex h-[220px] flex-col items-center justify-center text-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <p className="mt-2 text-sm font-medium text-foreground">Queue clear</p>
                <p className="text-xs text-muted-foreground">No open marketplace orders.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {queues!.openOrders.map((row) => (
                  <OpenOrderRow key={row.id} row={row} />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Open shipping labels</p>
                <p className="text-xs text-muted-foreground">
                  Ready to ship or failed label automation
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="tabular-nums font-normal border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                >
                  {stats ? compactNumber(stats.openLabels) : '—'} ready
                </Badge>
                {(stats?.openLabelFailures ?? 0) > 0 ? (
                  <Badge
                    variant="outline"
                    className="tabular-nums font-normal border-rose-500/30 text-rose-700 dark:text-rose-400"
                  >
                    {compactNumber(stats!.openLabelFailures)} failed
                  </Badge>
                ) : null}
              </div>
            </div>
            {(queues?.openLabels.length ?? 0) === 0 ? (
              <div className="flex h-[220px] flex-col items-center justify-center text-center">
                <Tag className="h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-foreground">No open labels</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  No prepared labels waiting to ship, and no open failures.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {queues!.openLabels.map((row) => (
                  <OpenLabelRow key={`${row.kind}-${row.id}`} row={row} />
                ))}
              </div>
            )}
            <div className="mt-3 border-t border-border/70 pt-3">
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2" asChild>
                <Link href="/admin/shipping">
                  Open shipping desk
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
