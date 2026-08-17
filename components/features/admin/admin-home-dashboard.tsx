import Link from 'next/link'
import type { AdminNavGroupConfig } from '@/lib/admin-nav'
import type { AdminNavBadgeCounts } from '@/lib/admin-nav-badge-counts'
import { AdminHomeGreeting } from '@/components/features/admin/admin-home-greeting'
import { AdminHomeIcon } from '@/components/features/admin/admin-home-icon'
import { cn } from '@/lib/utils'

const TILE_CLASSES = [
  'bg-[#FF6B4A] hover:bg-[#E85A3C] hover:shadow-[#FF6B4A]/40',
  'bg-[#2EC4B6] hover:bg-[#22A99D] hover:shadow-[#2EC4B6]/40',
  'bg-[#7C5CFF] hover:bg-[#6548E8] hover:shadow-[#7C5CFF]/40',
  'bg-[#FF8C42] hover:bg-[#E67A32] hover:shadow-[#FF8C42]/40',
  'bg-[#F43F8A] hover:bg-[#D92F76] hover:shadow-[#F43F8A]/40',
  'bg-[#3B82F6] hover:bg-[#2563EB] hover:shadow-[#3B82F6]/40',
  'bg-[#10B981] hover:bg-[#059669] hover:shadow-[#10B981]/40',
  'bg-[#F59E0B] hover:bg-[#D97706] hover:shadow-[#F59E0B]/40',
  'bg-[#06B6D4] hover:bg-[#0891B2] hover:shadow-[#06B6D4]/40',
  'bg-[#8B5CF6] hover:bg-[#7C3AED] hover:shadow-[#8B5CF6]/40',
  'bg-[#EF4444] hover:bg-[#DC2626] hover:shadow-[#EF4444]/40',
  'bg-[#14B8A6] hover:bg-[#0D9488] hover:shadow-[#14B8A6]/40',
] as const

const GROUP_THEMES: Record<
  string,
  { chip: string; panel: string; emoji: string }
> = {
  overview: {
    chip: 'bg-[#DBEAFE] text-[#1D4ED8]',
    panel: 'bg-gradient-to-br from-[#EFF6FF] via-white to-[#DBEAFE]',
    emoji: '✦',
  },
  'orders-shipping': {
    chip: 'bg-[#FFEDD5] text-[#C2410C]',
    panel: 'bg-gradient-to-br from-[#FFF7ED] via-white to-[#FFEDD5]',
    emoji: '◎',
  },
  analytics: {
    chip: 'bg-[#EDE9FE] text-[#6D28D9]',
    panel: 'bg-gradient-to-br from-[#F5F3FF] via-white to-[#EDE9FE]',
    emoji: '◈',
  },
  'customer-service': {
    chip: 'bg-[#FCE7F3] text-[#BE185D]',
    panel: 'bg-gradient-to-br from-[#FDF2F8] via-white to-[#FCE7F3]',
    emoji: '♡',
  },
  'admin-tools': {
    chip: 'bg-[#D1FAE5] text-[#047857]',
    panel: 'bg-gradient-to-br from-[#ECFDF5] via-white to-[#D1FAE5]',
    emoji: '⚙',
  },
}

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
  let colorIndex = 0

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#8BA4C8] via-[#B8A9C9] to-[#E8B4A8] px-6 py-7 text-white shadow-sm">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-16 h-36 w-36 rounded-full bg-[#C5D5C0]/35"
          aria-hidden
        />
        <AdminHomeGreeting displayName={displayName} />
        <p className="relative mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-white/90">
          Go big or go home
        </p>
      </header>

        {groups.map((group) => {
          const theme = GROUP_THEMES[group.id] ?? {
            chip: 'bg-muted text-foreground',
            panel: 'bg-muted/40',
            emoji: '•',
          }

          return (
            <section
              key={group.id}
              className={cn('rounded-3xl p-4 shadow-sm ring-1 ring-black/5 sm:p-5', theme.panel)}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                    theme.chip,
                  )}
                >
                  <span aria-hidden>{theme.emoji}</span>
                  {group.label}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {group.items.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {group.items.map((item) => {
                  const tileClass = TILE_CLASSES[colorIndex % TILE_CLASSES.length]
                  colorIndex += 1
                  const badge = badgeCounts[item.href] ?? 0

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'relative flex min-h-[4.5rem] flex-col items-start justify-between rounded-2xl px-3 py-2.5 text-white shadow-sm transition-all duration-200',
                        'hover:-translate-y-0.5 hover:shadow-lg',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#7C5CFF]',
                        tileClass,
                      )}
                    >
                      {badge > 0 ? (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-[#F43F8A] shadow">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      ) : null}
                      <AdminHomeIcon icon={item.icon} />
                      <span className="text-[13px] font-semibold leading-snug">
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
