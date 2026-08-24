import type { ComponentType, ReactNode } from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  BadgePercent,
  Boxes,
  Coins,
  DollarSign,
  Gauge,
  Layers,
  Megaphone,
  MessageSquare,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Tag,
  TrendingDown,
  TrendingUp,
  Trophy,
  Truck,
  UserPlus,
  Users,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import type { AdminPlatformPurchaseFees } from '@/lib/services/adminPlatformFees'
import type {
  AdminBusinessInsights,
  AdminInsightsBrandRow,
  AdminInsightsSectionRow,
  AdminInsightsTopSeller,
  TrendMetric,
} from '@/lib/types/adminBusinessInsights'
import type {
  AdminOverviewListingPreview,
  AdminOverviewOrderPreview,
  AdminOverviewSnapshot,
  AdminOverviewSupportPreview,
  AdminOverviewUserPreview,
} from '@/lib/db/adminOverview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminMomentumMatrix } from '@/components/features/admin/admin-momentum-matrix'
import { AdminMonthlyRevenueTable } from '@/components/features/admin/admin-monthly-revenue-table'
import { AdminOverviewPeriodFilter } from '@/components/features/admin/admin-overview-period-filter'
import { AdminRevenueChart } from '@/components/features/admin/admin-revenue-chart'
import type {
  AdminMomentumMatrix as AdminMomentumMatrixData,
  AdminMonthlyRevenueRow,
} from '@/lib/types/adminBusinessInsights'
import { listingDetailHref } from '@/lib/listing-href'
import { capitalizeWords } from '@/lib/listing-labels'
import { BUSINESS_TIMEZONE_LABEL } from '@/lib/utils/business-timezone'
import { formatCompactUsd } from '@/lib/utils/format-compact-usd'
import { cn } from '@/lib/utils'

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount)
}

function compactUsd(amount: number): string {
  if (Math.abs(amount) >= 10_000) {
    return formatCompactUsd(amount)
  }
  return formatUsd(amount)
}

function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

function rel(dateIso: string): string {
  try {
    return formatDistanceToNow(new Date(dateIso), { addSuffix: true })
  } catch {
    return '—'
  }
}

function supportChannelLabel(source: string): string {
  return source === 'messages_support' ? 'Messages' : 'Website'
}

function orderStatusBadgeVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'confirmed':
      return 'secondary'
    case 'refunded':
      return 'destructive'
    default:
      return 'outline'
  }
}

function supportStatusLabel(status: AdminOverviewSupportPreview['support_status']): string {
  switch (status) {
    case 'new':
      return 'New'
    case 'triaged':
      return 'Triaged'
    case 'ticket_created':
      return 'Ticket linked'
    default:
      return 'Resolved'
  }
}

function supportStatusBadgeVariant(
  status: AdminOverviewSupportPreview['support_status'],
): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'new':
      return 'outline'
    case 'triaged':
      return 'secondary'
    case 'ticket_created':
      return 'default'
    default:
      return 'outline'
  }
}

function sectionLabel(section: string): string {
  if (section === 'surfboards') return 'Used surfboards'
  if (section === 'new') return 'New & retail'
  return capitalizeWords(section.replace(/_/g, ' '))
}

type Accent = 'neutral' | 'emerald' | 'amber' | 'sky' | 'violet' | 'rose'

const ACCENT_CHIP: Record<Accent, string> = {
  neutral: 'bg-secondary text-foreground',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}

const SECTION_BAR: Record<string, string> = {
  surfboards: 'bg-sky-500',
  new: 'bg-violet-500',
  unknown: 'bg-muted-foreground/40',
}

// --- Delta + KPI ---------------------------------------------------------

/** Trend pill comparing a metric against the prior period. */
function DeltaBadge({ delta, invert }: { delta: TrendMetric; invert?: boolean }) {
  if (delta.deltaPct === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
        {delta.current > 0 ? 'New' : '—'}
      </span>
    )
  }
  const pct = delta.deltaPct
  const positive = pct >= 0
  const good = invert ? !positive : positive
  const Icon = positive ? TrendingUp : TrendingDown
  const magnitude = Math.abs(pct)
  const text = `${positive ? '+' : '−'}${magnitude >= 10 ? magnitude.toFixed(0) : magnitude.toFixed(1)}%`
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
        good
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {text}
    </span>
  )
}

interface KpiCardProps {
  icon: ComponentType<{ className?: string }>
  accent: Accent
  label: string
  value: string
  delta: TrendMetric
  invertDelta?: boolean
  footnote: string
}

function KpiCard({ icon: Icon, accent, label, value, delta, invertDelta, footnote }: KpiCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-foreground/15 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', ACCENT_CHIP[accent])}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </div>
      <div className="mt-4 flex items-end gap-2">
        <p className="text-2xl font-bold leading-none tabular-nums tracking-tight text-foreground sm:text-[28px]">
          {value}
        </p>
        <span className="mb-0.5">
          <DeltaBadge delta={delta} invert={invertDelta} />
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{footnote}</p>
    </div>
  )
}

interface SimpleStatProps {
  icon: ComponentType<{ className?: string }>
  accent: Accent
  label: string
  value: string | number
  delta?: TrendMetric
  footnote: string
}

function SimpleStat({ icon: Icon, accent, label, value, delta, footnote }: SimpleStatProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-foreground/15 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', ACCENT_CHIP[accent])}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </div>
      <div className="mt-4 flex items-end gap-2">
        <p className="text-2xl font-bold leading-none tabular-nums tracking-tight text-foreground sm:text-[28px]">
          {value}
        </p>
        {delta ? (
          <span className="mb-0.5">
            <DeltaBadge delta={delta} />
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{footnote}</p>
    </div>
  )
}

interface RatioTileProps {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
  description: string
  tone?: 'neutral' | 'good' | 'warn'
}

function RatioTile({ icon: Icon, label, value, description, tone = 'neutral' }: RatioTileProps) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          tone === 'good'
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : tone === 'warn'
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-secondary text-foreground',
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

// --- Attention + feeds ---------------------------------------------------

interface AttentionTileProps {
  href: string
  label: string
  value: number
  description: string
}

function AttentionTile({ href, label, value, description }: AttentionTileProps) {
  const warn = value > 0
  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col rounded-2xl border p-4 transition-all duration-200',
        warn
          ? 'border-amber-500/40 bg-amber-500/[0.06] hover:border-amber-500/60 hover:shadow-sm'
          : 'border-border bg-card hover:border-foreground/15 hover:shadow-sm',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <ArrowUpRight
          className="h-4 w-4 shrink-0 -translate-y-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </div>
      <p
        className={cn(
          'mt-3 text-2xl font-bold leading-none tabular-nums',
          warn ? 'text-amber-700 dark:text-amber-400' : 'text-foreground',
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>
    </Link>
  )
}

interface FeedCardProps {
  icon: ComponentType<{ className?: string }>
  accent: Accent
  title: string
  description: string
  href?: string
  actionLabel?: string
  children: ReactNode
}

function FeedCard({ icon: Icon, accent, title, description, href, actionLabel, children }: FeedCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex items-start gap-3">
          <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', ACCENT_CHIP[accent])}>
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div>
            <CardTitle className="font-headline text-base font-semibold">{title}</CardTitle>
            <CardDescription className="mt-0.5">{description}</CardDescription>
          </div>
        </div>
        {href && actionLabel ? (
          <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-muted-foreground" asChild>
            <Link href={href}>
              {actionLabel} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1 pt-0">{children}</CardContent>
    </Card>
  )
}

function EmptyState({ label }: { label: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{label}</p>
}

function ListingRow({ listing }: { listing: AdminOverviewListingPreview }) {
  const href = listingDetailHref({ id: listing.id, slug: listing.slug, section: listing.section })
  return (
    <div className="-mx-2 flex items-start justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <Link href={href} className="font-medium text-foreground hover:underline">
          {capitalizeWords(listing.title)}
        </Link>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {listing.seller_display_name ?? 'Unknown'} · {listing.section} · {rel(listing.created_at)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums">{formatUsd(listing.price)}</p>
        <Badge variant="secondary" className="mt-1 text-[10px] capitalize">
          {listing.status}
        </Badge>
      </div>
    </div>
  )
}

function SupportRow({ row }: { row: AdminOverviewSupportPreview }) {
  return (
    <div className="-mx-2 flex flex-col gap-1 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{row.name}</span>
        <Badge variant={supportStatusBadgeVariant(row.support_status)} className="text-[10px]">
          {supportStatusLabel(row.support_status)}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {supportChannelLabel(row.source)}
        </Badge>
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {row.email} · {rel(row.created_at)}
      </p>
      {row.subject ? (
        <p className="line-clamp-2 text-sm text-foreground">{row.subject}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground">No subject</p>
      )}
    </div>
  )
}

function UserRow({ row, canLink }: { row: AdminOverviewUserPreview; canLink: boolean }) {
  const label = row.display_name?.trim() || row.email || 'Member'
  const inner = (
    <>
      <p className="font-medium text-foreground">{label}</p>
      <p className="truncate text-xs text-muted-foreground">
        {row.email ?? `${row.id.slice(0, 8)}…`} · {rel(row.created_at)}
      </p>
    </>
  )
  return (
    <div className="-mx-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
      {canLink ? (
        <Link href={`/admin/users/${row.id}`} className="block">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  )
}

type OrderPreview = Pick<
  AdminOverviewOrderPreview,
  'id' | 'order_num' | 'status' | 'amount' | 'created_at'
>

function OrderRow({ row }: { row: OrderPreview }) {
  return (
    <div className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
      <div className="min-w-0">
        <Link
          href={`/admin/orders/${row.id}`}
          className="font-mono text-sm font-medium hover:underline"
        >
          #{row.order_num ?? row.id.slice(0, 8)}
        </Link>
        <p className="text-xs text-muted-foreground">{rel(row.created_at)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-semibold tabular-nums">{formatUsd(row.amount)}</span>
        <Badge variant={orderStatusBadgeVariant(row.status)} className="text-[10px] capitalize">
          {row.status}
        </Badge>
      </div>
    </div>
  )
}

// --- Leaderboards --------------------------------------------------------

function SellerRow({ seller, max, rank }: { seller: AdminInsightsTopSeller; max: number; rank: number }) {
  const pct = max > 0 ? (seller.gmv / max) * 100 : 0
  return (
    <div className="-mx-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-secondary text-[11px] font-semibold tabular-nums text-muted-foreground">
            {rank}
          </span>
          <Link
            href={`/admin/users/${seller.id}`}
            className="truncate font-medium text-foreground hover:underline"
          >
            {seller.name}
          </Link>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums">{compactUsd(seller.gmv)}</p>
          <p className="text-[11px] text-muted-foreground">
            {seller.orders} order{seller.orders === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function BrandRow({ brand, max, rank }: { brand: AdminInsightsBrandRow; max: number; rank: number }) {
  const pct = max > 0 ? (brand.gmv / max) * 100 : 0
  return (
    <div className="-mx-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-secondary text-[11px] font-semibold tabular-nums text-muted-foreground">
            {rank}
          </span>
          <span className="truncate font-medium text-foreground">{brand.brand}</span>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums">{compactUsd(brand.gmv)}</p>
          <p className="text-[11px] text-muted-foreground">
            {brand.orders} sale{brand.orders === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-sky-500/70" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function SectionMix({ rows }: { rows: AdminInsightsSectionRow[] }) {
  return (
    <div className="space-y-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {rows.map((r) => (
          <div
            key={r.section}
            className={cn('h-full first:rounded-l-full last:rounded-r-full', SECTION_BAR[r.section] ?? SECTION_BAR.unknown)}
            style={{ width: `${r.share}%` }}
            title={`${sectionLabel(r.section)} · ${formatPct(r.share, 0)}`}
          />
        ))}
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.section} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full', SECTION_BAR[r.section] ?? SECTION_BAR.unknown)} />
              <span className="text-foreground">{sectionLabel(r.section)}</span>
            </span>
            <span className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{formatPct(r.share, 0)}</span>
              <span className="font-semibold tabular-nums">{compactUsd(r.gmv)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface AdminOverviewViewProps {
  snapshot: AdminOverviewSnapshot
  isAdmin: boolean
  platformFees: AdminPlatformPurchaseFees | null
  platformFeesError: string | null
  insights: AdminBusinessInsights | null
  insightsError: string | null
  monthlyRevenue: AdminMonthlyRevenueRow[] | null
  monthlyRevenueError: string | null
  momentum: AdminMomentumMatrixData | null
  momentumError: string | null
  selectedYearMonth: string | null
}

export function AdminOverviewView({
  snapshot,
  isAdmin,
  platformFees,
  platformFeesError,
  insights,
  insightsError,
  monthlyRevenue,
  monthlyRevenueError,
  momentum,
  momentumError,
  selectedYearMonth,
}: AdminOverviewViewProps) {
  const totalListings = snapshot.totals.listings || 1
  const surfPct = Math.round((snapshot.listingsBySection.surfboards / totalListings) * 100)
  const periodBadgeLabel = insights?.periodLabel ?? `Last ${snapshot.periodDays} days`
  const compareFootnote = insights
    ? `vs ${insights.comparePeriodLabel}`
    : `last ${snapshot.periodDays} days`

  const attentionTotal =
    snapshot.attention.openSupportTickets +
    snapshot.attention.ordersPendingPayment +
    snapshot.attention.ordersConfirmedUnfulfilled +
    (isAdmin ? snapshot.attention.pendingBrandReviews : 0)

  const ordersFeed: OrderPreview[] = insights ? insights.recentOrders : snapshot.previews.recentOrders
  const listingsFeed = insights?.recentListings ?? snapshot.previews.recentListings
  const usersFeed = insights?.recentUsers ?? snapshot.previews.recentUsers
  const supportFeed = insights?.recentSupport ?? snapshot.previews.recentSupportTickets
  const maxSellerGmv = insights ? Math.max(0, ...insights.topSellers.map((s) => s.gmv)) : 0
  const maxBrandGmv = insights ? Math.max(0, ...insights.topBrands.map((b) => b.gmv)) : 0
  const periodActivityLabel = insights?.periodLabel ?? `the last ${snapshot.periodDays} days`

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">Overview</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              {periodBadgeLabel}
            </span>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {isAdmin
              ? insights?.periodMode === 'month'
                ? `Marketplace performance for ${insights.periodLabel} — compared to ${insights.comparePeriodLabel}.`
                : 'Marketplace performance, growth, and the queues that need attention — measured against the prior period.'
              : 'Marketplace pulse, queues that need attention, and fresh activity.'}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          {isAdmin ? (
            <Suspense fallback={null}>
              <AdminOverviewPeriodFilter selectedYearMonth={selectedYearMonth} />
            </Suspense>
          ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/contact-messages">Support inbox</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/orders">Orders</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/listings">Listings</Link>
          </Button>
          {isAdmin ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/used-board-market-dashboard">Market data</Link>
            </Button>
          ) : null}
        </div>
        </div>
      </div>

      {snapshot.errors.length > 0 || insightsError || monthlyRevenueError || momentumError ? (
        <Card className="border-destructive/40 bg-destructive/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="font-headline text-base text-destructive">
              Some metrics did not load
            </CardTitle>
            <CardDescription>
              Operations tools still work; retry later or check Supabase logs if this persists.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {insightsError ? <li>{insightsError}</li> : null}
              {monthlyRevenueError ? <li>{monthlyRevenueError}</li> : null}
              {momentumError ? <li>{momentumError}</li> : null}
              {snapshot.errors.slice(0, 6).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {insights ? (
        <>
          {/* Financial KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            <KpiCard
              icon={Truck}
              accent="emerald"
              label="GMV with shipping"
              value={compactUsd(insights.revenue.gmv.current)}
              delta={insights.revenue.gmv}
              footnote={`${compareFootnote} · ${compactUsd(insights.revenue.gmv.previous)}`}
            />
            <KpiCard
              icon={DollarSign}
              accent="emerald"
              label="GMV without shipping"
              value={compactUsd(insights.revenue.gmvWithoutShipping.current)}
              delta={insights.revenue.gmvWithoutShipping}
              footnote={`${compareFootnote} · ${compactUsd(insights.revenue.gmvWithoutShipping.previous)}`}
            />
            <KpiCard
              icon={Coins}
              accent="sky"
              label="Platform revenue"
              value={compactUsd(insights.revenue.platformRevenue.current)}
              delta={insights.revenue.platformRevenue}
              footnote={
                insights.takeRatePct != null
                  ? `${formatPct(insights.takeRatePct)} marketplace take`
                  : '7% fee on listing item price'
              }
            />
            <KpiCard
              icon={Megaphone}
              accent="rose"
              label="Promo (marketing)"
              value={compactUsd(insights.revenue.marketingExpense.current)}
              delta={insights.revenue.marketingExpense}
              invertDelta
              footnote={`${compareFootnote} · Reswell-funded discounts`}
            />
            <KpiCard
              icon={ShoppingBag}
              accent="violet"
              label="Paid orders"
              value={String(insights.revenue.orders.current)}
              delta={insights.revenue.orders}
              footnote={`${compareFootnote} · ${insights.revenue.orders.previous} orders`}
            />
            <KpiCard
              icon={Receipt}
              accent="amber"
              label="Avg order value"
              value={compactUsd(insights.revenue.aov.current)}
              delta={insights.revenue.aov}
              footnote={`${compareFootnote} · ${compactUsd(insights.revenue.aov.previous)} AOV`}
            />
          </div>

          {/* Day-over-day momentum */}
          {momentum ? <AdminMomentumMatrix matrix={momentum} /> : null}

          {/* Revenue trend */}
          <AdminRevenueChart
            data={insights.daily}
            chartSubtitle={
              insights.periodMode === 'month'
                ? `Daily GMV and platform fees in ${insights.periodLabel} (${BUSINESS_TIMEZONE_LABEL})`
                : `Daily GMV and platform fees over the last ${insights.periodDays} days (${BUSINESS_TIMEZONE_LABEL})`
            }
            totalGmv={insights.revenue.gmv.current}
            totalOrders={insights.revenue.orders.current}
          />

          {monthlyRevenue ? (
            <AdminMonthlyRevenueTable
              rows={monthlyRevenue}
              selectedYearMonth={selectedYearMonth}
            />
          ) : null}

          {/* Lifetime context */}
          {platformFees ? (
            <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Lifetime GMV
                </p>
                <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground">
                  {compactUsd(platformFees.totalSaleVolume)}
                </p>
              </div>
              <div className="bg-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Lifetime platform revenue
                </p>
                <p className="mt-1.5 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {compactUsd(platformFees.totalFees)}
                </p>
              </div>
              <div className="bg-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Paid orders (all-time)
                </p>
                <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground">
                  {platformFees.confirmedCount}
                </p>
              </div>
              <div className="bg-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Fees realized (fulfilled)
                </p>
                <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground">
                  {compactUsd(platformFees.totalFeesFulfilled)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {platformFees.fulfilledOrderCount} delivered or picked up
                </p>
              </div>
            </div>
          ) : platformFeesError ? (
            <p className="text-sm text-muted-foreground">{platformFeesError}</p>
          ) : null}

          {/* Growth & supply */}
          <section className="space-y-3">
            <h2 className="font-headline text-lg font-semibold text-foreground">Growth &amp; supply</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <SimpleStat
                icon={UserPlus}
                accent="violet"
                label="New members"
                value={insights.growth.newMembers.current}
                delta={insights.growth.newMembers}
                footnote={`${compareFootnote} · ${insights.growth.newMembers.previous}`}
              />
              <SimpleStat
                icon={Package}
                accent="sky"
                label="New listings"
                value={insights.growth.newListings.current}
                delta={insights.growth.newListings}
                footnote={`${compareFootnote} · ${insights.growth.newListings.previous}`}
              />
              <SimpleStat
                icon={MessageSquare}
                accent="amber"
                label="Support intake"
                value={insights.growth.newSupportThreads.current}
                delta={insights.growth.newSupportThreads}
                footnote={`${compareFootnote} · ${insights.growth.newSupportThreads.previous}`}
              />
              <SimpleStat
                icon={Boxes}
                accent="neutral"
                label="Active listings"
                value={insights.supply.activeListings}
                footnote={`${insights.supply.activeSurfboards} active surfboards live`}
              />
              <SimpleStat
                icon={Gauge}
                accent="emerald"
                label="Sell-through"
                value={insights.supply.sellThroughPct != null ? formatPct(insights.supply.sellThroughPct, 0) : '—'}
                footnote={`${insights.supply.soldInPeriod} sold vs active board supply`}
              />
            </div>
          </section>

          {/* Business health */}
          <section className="space-y-3">
            <h2 className="font-headline text-lg font-semibold text-foreground">Business health</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <RatioTile
                icon={BadgePercent}
                label="Take rate"
                value={insights.takeRatePct != null ? formatPct(insights.takeRatePct) : '—'}
                description="Platform fees ÷ listing item GMV (7% take; promos excluded)"
                tone="good"
              />
              <RatioTile
                icon={Megaphone}
                label="Promo spend"
                value={compactUsd(insights.revenue.marketingExpense.current)}
                description="Reswell-funded codes, counted as marketing"
              />
              <RatioTile
                icon={Receipt}
                label="Refund rate"
                value={formatPct(insights.refundRatePct)}
                description={`${insights.refundCount} refunded in period`}
                tone={insights.refundRatePct >= 5 ? 'warn' : 'neutral'}
              />
              <RatioTile
                icon={Tag}
                label="Offer acceptance"
                value={
                  insights.offers.acceptanceRatePct != null
                    ? formatPct(insights.offers.acceptanceRatePct, 0)
                    : '—'
                }
                description={`${insights.offers.accepted} accepted of ${insights.offers.created.current} offers`}
              />
            </div>
          </section>
        </>
      ) : (
        /* Employee fallback: counts only (no service-role insights) */
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SimpleStat
              icon={Package}
              accent="sky"
              label="Catalog"
              value={snapshot.totals.listings}
              footnote={`${snapshot.totals.activeListings} active · ${surfPct}% surfboards`}
            />
            <SimpleStat
              icon={Users}
              accent="violet"
              label="Members"
              value={snapshot.totals.users}
              footnote="Registered profiles"
            />
            <SimpleStat
              icon={ShoppingBag}
              accent="emerald"
              label="Paid orders"
              value={snapshot.pulse.ordersConfirmedInPeriod}
              footnote={`Confirmed in the last ${snapshot.periodDays} days`}
            />
            <SimpleStat
              icon={MessageSquare}
              accent="amber"
              label="Support intake"
              value={snapshot.pulse.newContactThreads}
              footnote={`${snapshot.attention.openSupportTickets} still open in the inbox`}
            />
          </div>
        </>
      )}

      {/* Needs attention */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-headline text-lg font-semibold text-foreground">Needs attention</h2>
          {attentionTotal === 0 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              All queues clear
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {attentionTotal} item{attentionTotal === 1 ? '' : 's'} across queues
            </span>
          )}
        </div>
        <div className={cn('grid gap-3 sm:grid-cols-2', isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
          <AttentionTile
            href="/admin/contact-messages"
            label="Open support"
            value={snapshot.attention.openSupportTickets}
            description="Still marked New in the inbox"
          />
          <AttentionTile
            href="/admin/orders"
            label="Pending checkout"
            value={snapshot.attention.ordersPendingPayment}
            description="Orders awaiting payment"
          />
          <AttentionTile
            href="/admin/orders"
            label="Fulfillment"
            value={snapshot.attention.ordersConfirmedUnfulfilled}
            description="Paid, not delivered or picked up"
          />
          {isAdmin ? (
            <AttentionTile
              href="/admin/listings/brand-requests"
              label="Brand requests"
              value={snapshot.attention.pendingBrandReviews}
              description="Awaiting catalog review"
            />
          ) : null}
        </div>
      </section>

      {/* Leaderboards */}
      {insights ? (
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <FeedCard
            icon={Trophy}
            accent="emerald"
            title="Top sellers"
            description={`By GMV · ${insights.periodLabel}`}
          >
            {insights.topSellers.length === 0 ? (
              <EmptyState label="No sales in this window." />
            ) : (
              <div className="divide-y divide-border">
                {insights.topSellers.map((s, i) => (
                  <SellerRow key={s.id} seller={s} max={maxSellerGmv} rank={i + 1} />
                ))}
              </div>
            )}
          </FeedCard>

          <FeedCard
            icon={Tag}
            accent="sky"
            title="Top brands"
            description={`By GMV · ${insights.periodLabel}`}
          >
            {insights.topBrands.length === 0 ? (
              <EmptyState label="No sales in this window." />
            ) : (
              <div className="divide-y divide-border">
                {insights.topBrands.map((b, i) => (
                  <BrandRow key={b.brand} brand={b} max={maxBrandGmv} rank={i + 1} />
                ))}
              </div>
            )}
          </FeedCard>

          <FeedCard
            icon={Layers}
            accent="violet"
            title="Revenue by section"
            description={`GMV split · ${insights.periodLabel}`}
          >
            {insights.sectionMix.length === 0 ? (
              <EmptyState label="No sales in this window." />
            ) : (
              <SectionMix rows={insights.sectionMix} />
            )}
          </FeedCard>
        </div>
      ) : null}

      {/* Activity feeds */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <FeedCard
            icon={Package}
            accent="sky"
            title={insights ? 'New listings' : 'Latest listings'}
            description={
              insights
                ? `Created in ${insights.periodLabel}`
                : 'Newest across the marketplace'
            }
            href="/admin/listings"
            actionLabel="All"
          >
            {listingsFeed.length === 0 ? (
              <EmptyState
                label={
                  insights
                    ? `No new listings in ${insights.periodLabel}.`
                    : 'No listings yet.'
                }
              />
            ) : (
              <div className="divide-y divide-border">
                {listingsFeed.map((l) => (
                  <ListingRow key={l.id} listing={l} />
                ))}
              </div>
            )}
          </FeedCard>

          <FeedCard
            icon={ShoppingBag}
            accent="emerald"
            title="Recent orders"
            description={
              insights
                ? `Paid orders in ${insights.periodLabel}`
                : 'Latest checkout activity'
            }
            href="/admin/orders"
            actionLabel="All"
          >
            {ordersFeed.length === 0 ? (
              <EmptyState
                label={
                  insights
                    ? `No paid orders in ${insights.periodLabel}.`
                    : 'No orders yet.'
                }
              />
            ) : (
              <div className="divide-y divide-border">
                {ordersFeed.map((o) => (
                  <OrderRow key={o.id} row={o} />
                ))}
              </div>
            )}
          </FeedCard>
        </div>

        <div className="space-y-6">
          <FeedCard
            icon={MessageSquare}
            accent="amber"
            title="Support inbox"
            description={
              insights
                ? `Tickets opened in ${insights.periodLabel}`
                : 'Most recent tickets by created date'
            }
            href="/admin/contact-messages"
            actionLabel="Inbox"
          >
            {supportFeed.length === 0 ? (
              <EmptyState
                label={
                  insights
                    ? `No support tickets in ${insights.periodLabel}.`
                    : 'No tickets yet.'
                }
              />
            ) : (
              <div className="divide-y divide-border">
                {supportFeed.map((r) => (
                  <SupportRow key={r.id} row={r} />
                ))}
              </div>
            )}
          </FeedCard>

          <FeedCard
            icon={UserPlus}
            accent="violet"
            title="New members"
            description={
              insights
                ? `Signups in ${insights.periodLabel}`
                : `Latest profiles in ${periodActivityLabel}`
            }
            href={isAdmin ? '/admin/users' : undefined}
            actionLabel={isAdmin ? 'Users' : undefined}
          >
            {!isAdmin ? (
              <p className="mb-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
                User administration is limited to full admins. Counts above still reflect overall signups.
              </p>
            ) : null}
            {usersFeed.length === 0 ? (
              <EmptyState
                label={
                  insights
                    ? `No new members in ${insights.periodLabel}.`
                    : 'No users yet.'
                }
              />
            ) : (
              <div className="divide-y divide-border">
                {usersFeed.map((u) => (
                  <UserRow key={u.id} row={u} canLink={isAdmin} />
                ))}
              </div>
            )}
          </FeedCard>

          {isAdmin ? (
            <FeedCard
              icon={Tag}
              accent="neutral"
              title="Pending brand requests"
              description="Queued catalog submissions"
              href="/admin/listings/brand-requests"
              actionLabel="Queue"
            >
              {snapshot.previews.pendingBrandRequests.length === 0 ? (
                <EmptyState label="No pending requests." />
              ) : (
                <div className="divide-y divide-border">
                  {snapshot.previews.pendingBrandRequests.map((b) => (
                    <div
                      key={b.id}
                      className="-mx-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <p className="font-medium text-foreground">{b.requested_name}</p>
                      <p className="text-xs text-muted-foreground">{rel(b.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </FeedCard>
          ) : null}
        </div>
      </div>

      {/* Tools footer */}
      <div className="rounded-2xl border border-border bg-muted/30 px-5 py-4">
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          More tools
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link
            href="/admin/search-analytics"
            className="text-muted-foreground transition-colors hover:text-foreground hover:underline"
          >
            Search analytics
          </Link>
          <Link
            href="/admin/search-daily-report"
            className="text-muted-foreground transition-colors hover:text-foreground hover:underline"
          >
            Search reports
          </Link>
          <Link
            href="/admin/catalog-overview"
            className="text-muted-foreground transition-colors hover:text-foreground hover:underline"
          >
            Brand catalog explorer
          </Link>
          <Link
            href="/admin/used-board-market-dashboard"
            className="text-muted-foreground transition-colors hover:text-foreground hover:underline"
          >
            Used board market
          </Link>
          {isAdmin ? (
            <Link
              href="/admin/shipping"
              className="text-muted-foreground transition-colors hover:text-foreground hover:underline"
            >
              Shipping tools
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
