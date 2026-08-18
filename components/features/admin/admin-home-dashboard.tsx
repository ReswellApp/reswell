import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { AdminNavGroupConfig } from '@/lib/admin-nav'
import type { AdminNavBadgeCounts } from '@/lib/admin-nav-badge-counts'
import { AdminHomeGreeting } from '@/components/features/admin/admin-home-greeting'
import { AdminHomeIcon } from '@/components/features/admin/admin-home-icon'
import { cn } from '@/lib/utils'

const GROUP_THEMES: Record<
  string,
  { chipDot: string; wells: readonly string[] }
> = {
  overview: {
    chipDot: 'bg-[#355185]',
    wells: ['bg-[#163060]', 'bg-[#355185]', 'bg-[#5574AD]', 'bg-[#7F9DD5]'],
  },
  'orders-shipping': {
    chipDot: 'bg-[#C45C3E]',
    wells: ['bg-[#9A3B24]', 'bg-[#C45C3E]', 'bg-[#D9784A]', 'bg-[#355185]'],
  },
  analytics: {
    chipDot: 'bg-[#2A7A72]',
    wells: ['bg-[#1F5C56]', 'bg-[#2A7A72]', 'bg-[#3D9A8F]', 'bg-[#5574AD]'],
  },
  'customer-service': {
    chipDot: 'bg-[#5574AD]',
    wells: ['bg-[#355185]', 'bg-[#5574AD]', 'bg-[#6B8BC0]', 'bg-[#7F9DD5]'],
  },
  'admin-tools': {
    chipDot: 'bg-[#001A4A]',
    wells: ['bg-[#001A4A]', 'bg-[#163060]', 'bg-[#355185]', 'bg-[#8A734A]'],
  },
}

const FALLBACK_THEME = {
  chipDot: 'bg-[#355185]',
  wells: ['bg-[#163060]', 'bg-[#355185]', 'bg-[#5574AD]', 'bg-[#7F9DD5]'],
} as const

interface AdminHomeDashboardProps {
  groups: AdminNavGroupConfig[]
  badgeCounts?: AdminNavBadgeCounts
  displayName?: string | null
}

export function AdminHomeDashboard({
  groups,
  badgeCounts = {},
  displayName,
}: AdminHomeDashboardProps) {
  return (
    <div className="space-y-6">
      <header className="px-1 py-1 sm:px-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5574AD]">
          Reswell admin
        </p>
        <div className="mt-2 text-[#163060]">
          <AdminHomeGreeting displayName={displayName} />
        </div>
        <p className="mt-2 max-w-md text-sm font-medium tracking-wide text-muted-foreground">
          Go big or go home
        </p>
      </header>

      {groups.map((group) => {
        const theme = GROUP_THEMES[group.id] ?? FALLBACK_THEME

        return (
          <section
            key={group.id}
            className="rounded-[2rem] border border-black/[0.04] bg-[#F9F9F2] p-4 shadow-soft dark:border-white/10 dark:bg-muted/40 sm:p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-3 px-0.5">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#163060] shadow-sm ring-1 ring-black/[0.05] dark:bg-card dark:text-foreground dark:ring-white/10">
                <span className={cn('h-1.5 w-1.5 rounded-full', theme.chipDot)} aria-hidden />
                {group.label}
              </span>
              <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                {group.items.length}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {group.items.map((item, index) => {
                const wellClass = theme.wells[index % theme.wells.length]
                const badge = badgeCounts[item.href] ?? 0

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'group relative flex min-h-[5.75rem] flex-col items-start justify-between rounded-3xl border border-black/[0.05] bg-white px-3.5 py-3',
                      'shadow-soft transition-all duration-200 ease-out',
                      'hover:-translate-y-0.5 hover:border-[#5574AD]/25 hover:shadow-soft-hover',
                      'active:translate-y-0 active:scale-[0.98]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5574AD] focus-visible:ring-offset-2',
                      'dark:border-white/10 dark:bg-card dark:hover:border-[#7F9DD5]/35',
                    )}
                  >
                    {badge > 0 ? (
                      <span className="absolute right-2.5 top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C45C3E] px-1 text-[10px] font-bold text-white">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    ) : (
                      <ArrowUpRight
                        className="absolute right-3 top-3 h-3.5 w-3.5 text-[#7F9DD5] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                        aria-hidden
                      />
                    )}
                    <span
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-2xl text-white shadow-sm',
                        wellClass,
                      )}
                    >
                      <AdminHomeIcon icon={item.icon} className="h-[18px] w-[18px]" />
                    </span>
                    <span className="pr-4 text-[13px] font-semibold leading-snug tracking-tight text-[#163060] dark:text-foreground">
                      {item.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
