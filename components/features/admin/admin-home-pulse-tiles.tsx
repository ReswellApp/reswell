import Link from 'next/link'
import {
  Gift,
  MapPin,
  MessageSquare,
  Package,
  PackageOpen,
  PackageX,
  Search,
  ShoppingBag,
  Stamp,
  Tag,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'

import type {
  AdminHomePulse,
  AdminHomePulseCounts,
  AdminHomePulseOps,
} from '@/lib/services/adminHomePulse'
import { cn } from '@/lib/utils'

type PulseWindow = 'today' | 'week'

type PulseTile = {
  id: string
  href: string
  label: string
  footnote: string
  icon: LucideIcon
  well: string
  value: string
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

function tilesFromPulse(counts: AdminHomePulseCounts, window: PulseWindow): PulseTile[] {
  const isWeek = window === 'week'
  return [
    {
      id: `${window}-users`,
      href: '/admin/users',
      label: 'New users',
      footnote: isWeek ? 'Past week' : 'Today',
      icon: UserPlus,
      well: 'bg-[#163060]',
      value: formatCount(counts.newUsers),
    },
    {
      id: `${window}-listings`,
      href: '/admin/listings',
      label: 'New listings',
      footnote: isWeek ? 'Past week' : 'Today',
      icon: Package,
      well: 'bg-[#355185]',
      value: formatCount(counts.newListings),
    },
    {
      id: `${window}-orders`,
      href: '/admin/orders',
      label: 'Orders',
      footnote: isWeek ? 'Paid past week' : 'Paid today',
      icon: ShoppingBag,
      well: 'bg-[#2A7A72]',
      value: formatCount(counts.orders),
    },
    {
      id: `${window}-messages`,
      href: '/admin/messages',
      label: 'Messages',
      footnote: isWeek ? 'Sent past week' : 'Sent today',
      icon: MessageSquare,
      well: 'bg-[#5574AD]',
      value: formatCount(counts.messages),
    },
    {
      id: `${window}-searches`,
      href: '/admin/search-analytics',
      label: 'Searches',
      footnote: counts.searchesTracked ? (isWeek ? 'Past week' : 'Today') : 'Search tracking off',
      icon: Search,
      well: 'bg-[#C45C3E]',
      value: counts.searchesTracked ? formatCount(counts.searches) : '—',
    },
    {
      id: `${window}-giveaway-entered`,
      href: '/admin/giveaways',
      label: 'Giveaway entered',
      footnote: isWeek ? 'Listed a board this week' : 'Listed a board today',
      icon: Gift,
      well: 'bg-[#8A734A]',
      value: formatCount(counts.giveawayEntered),
    },
    {
      id: `${window}-giveaway-no-board`,
      href: '/admin/giveaways',
      label: 'Giveaway — no board',
      footnote: isWeek ? 'Signed up this week, not entered' : 'Signed up today, not entered',
      icon: PackageX,
      well: 'bg-[#9A3B24]',
      value: formatCount(counts.giveawayNotEntered),
    },
    {
      id: `${window}-labels`,
      href: '/admin/shipping?tab=labels-created',
      label: 'Shipping labels',
      footnote: isWeek ? 'Created past week' : 'Created today',
      icon: Stamp,
      well: 'bg-[#3D3366]',
      value: formatCount(counts.shippingLabels),
    },
  ]
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function tilesFromOps(ops: AdminHomePulseOps): PulseTile[] {
  return [
    {
      id: 'ops-open-shipping',
      href: '/admin/orders#open-orders-shipping',
      label: 'Open orders',
      footnote: 'All time · labeled or not, not delivered',
      icon: PackageOpen,
      well: 'bg-[#2A7A72]',
      value: formatCount(ops.openShipping),
    },
    {
      id: 'ops-open-pickup',
      href: '/admin/orders#open-orders-pickup',
      label: 'Local pickup open',
      footnote: 'All time · pickup code not entered',
      icon: MapPin,
      well: 'bg-[#5C4E8A]',
      value: formatCount(ops.openPickup),
    },
    {
      id: 'ops-adjusted-labels',
      href: '/admin/shipping?tab=adjusted-labels',
      label: 'ShipEngine adjusted fees',
      footnote:
        ops.adjustedLabels > 0
          ? `${formatUsd(ops.adjustedFeesUsd)} extra billed`
          : 'Labels with a price increase',
      icon: Tag,
      well: 'bg-[#C45C3E]',
      value: formatCount(ops.adjustedLabels),
    },
  ]
}

function PulseRow({
  title,
  tiles,
  aside,
  dense,
}: {
  title: string
  tiles: PulseTile[]
  aside?: string
  dense?: boolean
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5574AD]">
          {title}
        </p>
        {aside ? <p className="text-[11px] text-muted-foreground">{aside}</p> : null}
      </div>
      <div
        className={cn(
          'grid grid-cols-2 gap-2.5 sm:grid-cols-3',
          dense ? 'xl:grid-cols-3' : 'xl:grid-cols-4 2xl:grid-cols-8',
        )}
      >
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Link
              key={tile.id}
              href={tile.href}
              className={cn(
                'group flex min-h-[6.25rem] flex-col justify-between rounded-2xl border border-black/[0.05] bg-white px-3.5 py-3',
                'shadow-soft transition-all duration-200 ease-out',
                'hover:-translate-y-0.5 hover:border-[#5574AD]/25 hover:shadow-soft-hover',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5574AD] focus-visible:ring-offset-2',
                'dark:border-white/10 dark:bg-card',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-sm',
                  tile.well,
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none tabular-nums tracking-tight text-[#163060] dark:text-foreground">
                  {tile.value}
                </p>
                <p className="mt-1 text-[12px] font-semibold leading-snug text-[#163060] dark:text-foreground">
                  {tile.label}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {tile.footnote}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

interface AdminHomePulseTilesProps {
  pulse: AdminHomePulse
  isAdmin?: boolean
}

export function AdminHomePulseTiles({ pulse, isAdmin = true }: AdminHomePulseTilesProps) {
  const remap = (tiles: PulseTile[]) =>
    tiles.map((tile) => {
      if (!isAdmin && (tile.href === '/admin/users' || tile.href.startsWith('/admin/shipping'))) {
        return { ...tile, href: '/admin/home' }
      }
      return tile
    })

  return (
    <section className="space-y-5">
      <PulseRow title="Open" tiles={remap(tilesFromOps(pulse.ops))} dense />
      <PulseRow
        title="Today"
        aside="Pacific Time"
        tiles={remap(tilesFromPulse(pulse.today, 'today'))}
      />
      <PulseRow title="Past week" tiles={remap(tilesFromPulse(pulse.week, 'week'))} />
    </section>
  )
}
