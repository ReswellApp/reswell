import type { ComponentType } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Coins,
  MessageSquare,
  Package,
  ShoppingBag,
  Sparkles,
  Tag,
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
import { Separator } from '@/components/ui/separator'
import { listingDetailHref } from '@/lib/listing-href'
import { capitalizeWords } from '@/lib/listing-labels'
import { cn } from '@/lib/utils'

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`
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
    case 'refunding':
      return 'outline'
    case 'refunded':
      return 'destructive'
    case 'pending':
      return 'outline'
    default:
      return 'outline'
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
    case 'resolved':
      return 'outline'
    default:
      return 'secondary'
  }
}

interface PulseMetricProps {
  icon: ComponentType<{ className?: string }>
  label: string
  value: number
  footnote?: string
}

function PulseMetric({ icon: Icon, label, value, footnote }: PulseMetricProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium leading-snug text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
        {footnote ? <p className="text-xs text-muted-foreground">{footnote}</p> : null}
      </CardContent>
    </Card>
  )
}

interface AttentionMetricProps {
  label: string
  value: number
  description: string
  warn?: boolean
}

function AttentionMetric({ label, value, description, warn }: AttentionMetricProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 transition-colors',
        warn && value > 0 ? 'border-amber-500/35 bg-amber-500/[0.06]' : 'border-border',
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

function ListingRow({ listing }: { listing: AdminOverviewListingPreview }) {
  const href = listingDetailHref({ id: listing.id, slug: listing.slug, section: listing.section })
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-0 last:pb-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <Link href={href} className="font-medium text-foreground hover:underline">
          {capitalizeWords(listing.title)}
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">
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
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-0 last:pb-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{row.name}</span>
        <Badge variant={supportStatusBadgeVariant(row.support_status)} className="text-[10px]">
          {row.support_status === 'new'
            ? 'New'
            : row.support_status === 'triaged'
              ? 'Triaged'
              : row.support_status === 'ticket_created'
                ? 'Ticket linked'
                : 'Resolved'}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {supportChannelLabel(row.source)}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {row.email} · {rel(row.created_at)}
      </p>
      {row.subject ? (
        <p className="text-sm text-foreground line-clamp-2">{row.subject}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">No subject</p>
      )}
    </div>
  )
}

function UserRow({ row, canLink }: { row: AdminOverviewUserPreview; canLink: boolean }) {
  const label = row.display_name?.trim() || row.email || 'Member'
  const inner = (
    <>
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">
        {row.email ?? row.id.slice(0, 8)}… · {rel(row.created_at)}
      </p>
    </>
  )
  return (
    <div className="border-b border-border py-3 last:border-0 last:pb-0 first:pt-0">
      {canLink ? (
        <Link href={`/admin/users/${row.id}`} className="block hover:underline">
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
    <div className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0 last:pb-0 first:pt-0">
      <div className="min-w-0">
        <Link href={`/admin/orders/${row.id}`} className="font-mono text-sm font-medium hover:underline">
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

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
        <p className="max-w-2xl text-muted-foreground">
          Marketplace pulse, queues that need attention, and fresh activity — optimized for a quick read before
          you dive into tools.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
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
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/live">Live</Link>
          </Button>
        </div>
      </div>

      {snapshot.errors.length > 0 ? (
        <Card className="border-destructive/40 bg-destructive/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive">Some metrics did not load</CardTitle>
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

      {/* Totals */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Catalog</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{snapshot.totals.listings}</p>
            <p className="text-xs text-muted-foreground">{snapshot.totals.activeListings} active right now</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{snapshot.totals.users}</p>
            <p className="text-xs text-muted-foreground">Registered profiles</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Surfboards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Section listings</span>
              <span className="font-medium tabular-nums">{snapshot.listingsBySection.surfboards}</span>
            </div>
            <p className="text-xs text-muted-foreground">Share of total catalog</p>
            <div className="pt-1">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-neutral-600 dark:bg-neutral-400"
                  style={{ width: `${surfPct}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pulse */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Last {snapshot.periodDays} days</h2>
            <p className="text-sm text-muted-foreground">
              New activity across listings, members, support intake, and checkout.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PulseMetric
            icon={Sparkles}
            label="New listings"
            value={snapshot.pulse.newListings}
            footnote="Created in period"
          />
          <PulseMetric
            icon={UserPlus}
            label="New members"
            value={snapshot.pulse.newUsers}
            footnote="Profiles created"
          />
          <PulseMetric
            icon={MessageSquare}
            label="Support threads"
            value={snapshot.pulse.newContactThreads}
            footnote="Inbox + Messages intake"
          />
          <PulseMetric
            icon={ShoppingBag}
            label="Paid orders"
            value={snapshot.pulse.ordersConfirmedInPeriod}
            footnote="Confirmed in period"
          />
        </div>
      </section>

      {/* Attention */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Needs attention</h2>
        <div className={cn('grid gap-3', isAdmin ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3')}>
          <AttentionMetric
            label="Open support tickets"
            value={snapshot.attention.openSupportTickets}
            description="Still marked New in the inbox"
            warn
          />
          <AttentionMetric
            label="Pending checkout"
            value={snapshot.attention.ordersPendingPayment}
            description="Orders awaiting payment"
            warn
          />
          <AttentionMetric
            label="Fulfillment in progress"
            value={snapshot.attention.ordersConfirmedUnfulfilled}
            description="Paid, not delivered or picked up yet"
            warn
          />
          {isAdmin ? (
            <AttentionMetric
              label="Brand requests"
              value={snapshot.attention.pendingBrandReviews}
              description="Awaiting catalog review"
              warn
            />
          ) : null}
        </div>
      </section>

      {isAdmin && (platformFeesError || platformFees) ? (
        <Card className="border-primary/25 bg-primary/[0.04]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Coins className="h-5 w-5 text-primary" aria-hidden />
              Platform fee revenue (7%)
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
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    7% fee (all paid orders)
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                    {formatUsd(platformFees.totalFees)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    7% fee (fulfillment complete)
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                    {formatUsd(platformFees.totalFeesFulfilled)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {platformFees.fulfilledOrderCount} orders delivered or picked up
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Paid orders
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                    {platformFees.confirmedCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Gross sale volume
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                    {formatUsd(platformFees.totalSaleVolume)}
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-5 w-5" aria-hidden />
                  Latest listings
                </CardTitle>
                <CardDescription>Newest across the marketplace</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0 gap-1" asChild>
                <Link href="/admin/listings">
                  All <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {snapshot.previews.recentListings.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No listings yet.</p>
              ) : (
                snapshot.previews.recentListings.map((l) => <ListingRow key={l.id} listing={l} />)
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingBag className="h-5 w-5" aria-hidden />
                  Recent orders
                </CardTitle>
                <CardDescription>Latest checkout activity</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0 gap-1" asChild>
                <Link href="/admin/orders">
                  All <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {snapshot.previews.recentOrders.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                snapshot.previews.recentOrders.map((o) => <OrderRow key={o.id} row={o} />)
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-5 w-5" aria-hidden />
                  Support inbox
                </CardTitle>
                <CardDescription>Most recent tickets by created date</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0 gap-1" asChild>
                <Link href="/admin/contact-messages">
                  Inbox <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {snapshot.previews.recentSupportTickets.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No tickets yet.</p>
              ) : (
                snapshot.previews.recentSupportTickets.map((r) => <SupportRow key={r.id} row={r} />)
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5" aria-hidden />
                  New members
                </CardTitle>
                <CardDescription>Latest profiles (by signup)</CardDescription>
              </div>
              {isAdmin ? (
                <Button variant="ghost" size="sm" className="shrink-0 gap-1" asChild>
                  <Link href="/admin/users">
                    Users <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="pt-0">
              {!isAdmin ? (
                <p className="border-b border-border pb-3 text-xs text-muted-foreground">
                  User administration is limited to full admins. Counts above still reflect overall signups.
                </p>
              ) : null}
              {snapshot.previews.recentUsers.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No users yet.</p>
              ) : (
                snapshot.previews.recentUsers.map((u) => (
                  <UserRow key={u.id} row={u} canLink={isAdmin} />
                ))
              )}
            </CardContent>
          </Card>

          {isAdmin ? (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Tag className="h-5 w-5" aria-hidden />
                    Pending brand requests
                  </CardTitle>
                  <CardDescription>Queued catalog submissions</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="shrink-0 gap-1" asChild>
                  <Link href="/admin/listings/brand-requests">
                    Queue <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {snapshot.previews.pendingBrandRequests.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No pending requests.</p>
                ) : (
                  snapshot.previews.pendingBrandRequests.map((b) => (
                    <div key={b.id} className="border-b border-border py-3 last:border-0 last:pb-0 first:pt-0">
                      <p className="font-medium text-foreground">{b.requested_name}</p>
                      <p className="text-xs text-muted-foreground">{rel(b.created_at)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Separator />

      <footer className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <Link href="/admin/search-analytics" className="hover:text-foreground hover:underline">
          Search analytics
        </Link>
        <Link href="/admin/catalog-overview" className="hover:text-foreground hover:underline">
          Brand catalog explorer
        </Link>
        <Link href="/admin/used-board-market-dashboard" className="hover:text-foreground hover:underline">
          Used board market
        </Link>
        {isAdmin ? (
          <Link href="/admin/shipping" className="hover:text-foreground hover:underline">
            Shipping tools
          </Link>
        ) : null}
      </footer>
    </div>
  )
}
