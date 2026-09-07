'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { MapPin, PackageOpen, Tag, Truck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { deliveryStatusLabel } from '@/lib/order-status'
import { formatOrderNumForCustomer } from '@/lib/order-num-display'
import type { AdminOrdersOpsOrderRow } from '@/lib/services/adminOrdersStats'
import { cn } from '@/lib/utils'

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

function DeliveryBadge({ status }: { status: string | null }) {
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
      {status ? deliveryStatusLabel(status) : '—'}
    </Badge>
  )
}

function OpenOrderLine({ row }: { row: AdminOrdersOpsOrderRow }) {
  return (
    <Link
      href={`/admin/orders/${row.id}`}
      className="group flex items-start gap-3 px-1 py-2.5 transition-colors hover:bg-background/80"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium text-foreground group-hover:underline">
            {formatOrderNumForCustomer(row.order_num, row.id)}
          </span>
          <DeliveryBadge status={row.delivery_status} />
          {row.has_prepared_label || row.tracking_number ? (
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

function OpenColumn({
  id,
  title,
  hint,
  icon: Icon,
  rows,
  empty,
}: {
  id: string
  title: string
  hint: string
  icon: typeof Truck
  rows: AdminOrdersOpsOrderRow[]
  empty: string
}) {
  return (
    <div id={id} className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
            {title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <Badge variant="outline" className="tabular-nums font-normal">
          {rows.length}
        </Badge>
      </div>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="max-h-[28rem] divide-y divide-border/70 overflow-y-auto">
          {rows.map((row) => (
            <OpenOrderLine key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}

interface AdminOpenOrdersSectionProps {
  shipping: AdminOrdersOpsOrderRow[]
  pickup: AdminOrdersOpsOrderRow[]
  loading?: boolean
}

export function AdminOpenOrdersSection({
  shipping,
  pickup,
  loading = false,
}: AdminOpenOrdersSectionProps) {
  if (loading) {
    return (
      <Card className="rounded-2xl border-border bg-card shadow-none hover:shadow-none">
        <CardHeader className="pb-3">
          <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      id="open-orders"
      className="scroll-mt-24 rounded-2xl border-border bg-card shadow-none hover:shadow-none"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <PackageOpen className="h-5 w-5 text-muted-foreground" aria-hidden />
          Open orders
        </CardTitle>
        <CardDescription>
          Same live bucket as the home tiles: shipping until delivered, pickup until the seller
          enters the code.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <OpenColumn
          id="open-orders-shipping"
          title="Shipping"
          hint="Confirmed · not delivered"
          icon={Truck}
          rows={shipping}
          empty="No open shipping orders."
        />
        <OpenColumn
          id="open-orders-pickup"
          title="Local pickup"
          hint="Confirmed · pickup code not entered"
          icon={MapPin}
          rows={pickup}
          empty="No open pickup orders."
        />
      </CardContent>
    </Card>
  )
}
