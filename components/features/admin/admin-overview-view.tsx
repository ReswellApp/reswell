import type { ComponentType, ReactNode } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Coins,
  MessageSquare,
  Package,
  ShieldCheck,
  ShoppingBag,
  Tag,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import type { AdminPlatformPurchaseFees } from '@/lib/services/adminPlatformFees'
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
import { listingDetailHref } from '@/lib/listing-href'
import { capitalizeWords } from '@/lib/listing-labels'
import { cn } from '@/lib/utils'

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount)
}

function compactUsd(amount: number): string {
  if (amount >= 10000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  }
  return formatUsd(amount)
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

type Accent = 'neutral' | 'emerald' | 'amber' | 'sky' | 'violet'

const ACCENT_CHIP: Record<Accent, string> = {
  neutral: 'bg-secondary text-foreground',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
}

interface StatCardProps {
  icon: ComponentType<{ className?: string }>
  label: string
  value: number | string
  footnote: string
  accent: Accent
  delta?: number
  deltaLabel?: string
}

function StatCard({ icon: Icon, label, value, footnote, accent, delta, deltaLabel }: StatCardProps) {
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
        <p className="text-3xl font-bold leading-none tabular-nums tracking-tight text-foreground">
          {value}
        </p>
        {typeof delta === 'number' && delta > 0 ? (
          <span className="mb-0.5 inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-3 w-3" aria-hidden />+{delta}
            {deltaLabel ? <span className="font-medium text-emerald-600/70 dark:text-emerald-400/70">{deltaLabel}</span> : null}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{footnote}</p>
    </div>
  )
}

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

function OrderRow({ row }: { row: AdminOverviewOrderPreview }) {
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

export interface AdminOverviewViewProps {
  snapshot: AdminOverviewSnapshot
  isAdmin: boolean
  platformFees: AdminPlatformPurchaseFees | null
  platformFeesError: string | null
}

export function AdminOverviewView({
  snapshot,
  isAdmin,
  platformFees,
  platformFeesError,
}: AdminOverviewViewProps) {
  const totalListings = snapshot.totals.listings || 1
  const surfPct = Math.round((snapshot.listingsBySection.surfboards / totalListings) * 100)

  const attentionTotal =
    snapshot.attention.openSupportTickets +
    snapshot.attention.ordersPendingPayment +
    snapshot.attention.ordersConfirmedUnfulfilled +
    (isAdmin ? snapshot.attention.pendingBrandReviews : 0)

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
              Last {snapshot.periodDays} days
            </span>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Marketplace pulse, queues that need attention, and fresh activity — a quick read before you dive
            into the tools.
          </p>
        </div>
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
              <Link href="/admin/users">Users</Link>
            </Button>
          ) : null}
          <Button variant="default" size="sm" className="gap-1.5" asChild>
            <Link href="/admin/live">
              <Activity className="h-4 w-4" aria-hidden />
              Live
            </Link>
          </Button>
        </div>
      </div>

      {snapshot.errors.length > 0 ? (
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
              {snapshot.errors.slice(0, 6).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Package}
          accent="sky"
          label="Catalog"
          value={snapshot.totals.listings}
          delta={snapshot.pulse.newListings}
          footnote={`${snapshot.totals.activeListings} active · ${surfPct}% surfboards`}
        />
        <StatCard
          icon={Users}
          accent="violet"
          label="Members"
          value={snapshot.totals.users}
          delta={snapshot.pulse.newUsers}
          footnote="Registered profiles"
        />
        <StatCard
          icon={ShoppingBag}
          accent="emerald"
          label="Paid orders"
          value={snapshot.pulse.ordersConfirmedInPeriod}
          footnote={`Confirmed in the last ${snapshot.periodDays} days`}
        />
        <StatCard
          icon={MessageSquare}
          accent="amber"
          label="Support intake"
          value={snapshot.pulse.newContactThreads}
          footnote={`${snapshot.attention.openSupportTickets} still open in the inbox`}
        />
      </div>

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

      {/* Platform revenue */}
      {isAdmin && (platformFeesError || platformFees) ? (
        <Card className="overflow-hidden border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.07] via-card to-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 font-headline text-base sm:text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Coins className="h-[18px] w-[18px]" aria-hidden />
              </span>
              Platform fee revenue
              <Badge variant="secondary" className="ml-0.5 text-[10px]">
                7%
              </Badge>
            </CardTitle>
            <CardDescription>
              Card payments settle on the platform Stripe account at checkout. Seller earnings credit after
              fulfillment. Figures use confirmed orders and listing currency.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {platformFeesError ? (
              <p className="text-sm text-muted-foreground">{platformFeesError}</p>
            ) : platformFees ? (
              <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-card p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    7% fee · all paid
                  </p>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {compactUsd(platformFees.totalFees)}
                  </p>
                </div>
                <div className="bg-card p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    7% fee · fulfilled
                  </p>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">
                    {compactUsd(platformFees.totalFeesFulfilled)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {platformFees.fulfilledOrderCount} delivered or picked up
                  </p>
                </div>
                <div className="bg-card p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Paid orders
                  </p>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">
                    {platformFees.confirmedCount}
                  </p>
                </div>
                <div className="bg-card p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Gross sale volume
                  </p>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">
                    {compactUsd(platformFees.totalSaleVolume)}
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Activity feeds */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <FeedCard
            icon={Package}
            accent="sky"
            title="Latest listings"
            description="Newest across the marketplace"
            href="/admin/listings"
            actionLabel="All"
          >
            {snapshot.previews.recentListings.length === 0 ? (
              <EmptyState label="No listings yet." />
            ) : (
              <div className="divide-y divide-border">
                {snapshot.previews.recentListings.map((l) => (
                  <ListingRow key={l.id} listing={l} />
                ))}
              </div>
            )}
          </FeedCard>

          <FeedCard
            icon={ShoppingBag}
            accent="emerald"
            title="Recent orders"
            description="Latest checkout activity"
            href="/admin/orders"
            actionLabel="All"
          >
            {snapshot.previews.recentOrders.length === 0 ? (
              <EmptyState label="No orders yet." />
            ) : (
              <div className="divide-y divide-border">
                {snapshot.previews.recentOrders.map((o) => (
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
            description="Most recent tickets by created date"
            href="/admin/contact-messages"
            actionLabel="Inbox"
          >
            {snapshot.previews.recentSupportTickets.length === 0 ? (
              <EmptyState label="No tickets yet." />
            ) : (
              <div className="divide-y divide-border">
                {snapshot.previews.recentSupportTickets.map((r) => (
                  <SupportRow key={r.id} row={r} />
                ))}
              </div>
            )}
          </FeedCard>

          <FeedCard
            icon={UserPlus}
            accent="violet"
            title="New members"
            description="Latest profiles by signup"
            href={isAdmin ? '/admin/users' : undefined}
            actionLabel={isAdmin ? 'Users' : undefined}
          >
            {!isAdmin ? (
              <p className="mb-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
                User administration is limited to full admins. Counts above still reflect overall signups.
              </p>
            ) : null}
            {snapshot.previews.recentUsers.length === 0 ? (
              <EmptyState label="No users yet." />
            ) : (
              <div className="divide-y divide-border">
                {snapshot.previews.recentUsers.map((u) => (
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
