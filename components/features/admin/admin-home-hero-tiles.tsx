import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, BadgeDollarSign, Package, ShoppingBag, Store } from 'lucide-react'
import type { AdminHomePulse } from '@/lib/services/adminHomePulse'
import { formatCompactUsd } from '@/lib/utils/format-compact-usd'
import { cn } from '@/lib/utils'

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

function growthCopy(current: number, previous: number): { text: string; up: boolean } | null {
  if (previous <= 0 && current <= 0) return null
  if (previous <= 0) return { text: 'Ahead of last month', up: true }
  const pct = ((current - previous) / previous) * 100
  return {
    text: `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% vs last month`,
    up: pct >= 0,
  }
}

interface AdminHomeHeroTilesProps {
  pulse: AdminHomePulse
}

export function AdminHomeHeroTiles({ pulse }: AdminHomeHeroTilesProps) {
  const takeRatePct =
    pulse.monthCommerce.gmv > 0
      ? (pulse.monthCommerce.platformRevenue / pulse.monthCommerce.gmv) * 100
      : null
  const sellThroughPct =
    pulse.monthCommerce.sales + pulse.supply.activeSurfboards > 0
      ? (pulse.monthCommerce.sales / (pulse.monthCommerce.sales + pulse.supply.activeSurfboards)) * 100
      : null

  const tiles = [
    {
      href: '/admin/home',
      label: 'Platform revenue',
      value: formatCompactUsd(pulse.monthCommerce.platformRevenue),
      growth: growthCopy(pulse.monthCommerce.platformRevenue, pulse.priorMonthToDateCommerce.platformRevenue),
      footnote: takeRatePct != null ? `${takeRatePct.toFixed(1)}% of GMV this month` : 'Fees + seller tips',
      tone: 'bg-[hsl(var(--admin-green))]',
      icon: BadgeDollarSign,
    },
    {
      href: '/admin/home',
      label: 'GMV',
      value: formatCompactUsd(pulse.monthCommerce.gmv),
      growth: growthCopy(pulse.monthCommerce.gmv, pulse.priorMonthToDateCommerce.gmv),
      footnote: 'Checkouts + tipped mark-as-sold',
      tone: 'bg-[hsl(var(--admin-orange))]',
      icon: Store,
    },
    {
      href: '/admin/orders',
      label: 'Sales',
      value: formatCount(pulse.monthCommerce.sales),
      growth: growthCopy(pulse.monthCommerce.sales, pulse.priorMonthToDateCommerce.sales),
      footnote:
        pulse.monthCommerce.sales > 0
          ? `${formatCompactUsd(pulse.monthCommerce.gmv / pulse.monthCommerce.sales)} average`
          : 'Paid sales this month',
      tone: 'bg-[hsl(var(--admin-blue))]',
      icon: ShoppingBag,
    },
    {
      href: '/admin/listings',
      label: 'Live listings',
      value: formatCount(pulse.supply.activeListings),
      growth: null,
      footnote:
        sellThroughPct != null
          ? `${sellThroughPct.toFixed(1)}% sell-through this month`
          : `${formatCount(pulse.supply.activeSurfboards)} surfboards live`,
      tone: 'bg-[hsl(var(--admin-purple))]',
      icon: Package,
    },
  ] as const

  return (
    <section>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Month to date · vs same stretch last month
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon
          const GrowthIcon = tile.growth?.up ? ArrowUpRight : ArrowDownRight
          return (
            <Link
              key={tile.label}
              href={tile.href}
              className={cn(
                'group relative overflow-hidden rounded-xl px-4 py-4 text-white shadow-sm',
                tile.tone,
              )}
            >
              <p className="text-2xl font-bold tabular-nums tracking-tight">{tile.value}</p>
              <p className="mt-1 text-sm font-medium text-white/90">{tile.label}</p>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-white/80">
                {tile.growth ? (
                  <>
                    <GrowthIcon className="h-3 w-3" aria-hidden />
                    {tile.growth.text}
                  </>
                ) : (
                  tile.footnote
                )}
              </p>
              {tile.growth ? (
                <p className="mt-0.5 text-[11px] text-white/70">{tile.footnote}</p>
              ) : null}
              <Icon className="absolute bottom-3 right-3 h-10 w-10 text-white/20" aria-hidden />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
