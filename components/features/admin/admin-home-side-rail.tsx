import Link from 'next/link'
import type { AdminNavBadgeCounts } from '@/lib/admin-nav-badge-counts'
import { cn } from '@/lib/utils'

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

type AttentionItem = {
  href: string
  label: string
  value: number
  tone: 'rose' | 'amber' | 'slate'
}

interface AdminHomeSideRailProps {
  badgeCounts?: AdminNavBadgeCounts
  isAdmin?: boolean
}

export function AdminHomeSideRail({
  badgeCounts = {},
  isAdmin = false,
}: AdminHomeSideRailProps) {
  const items: AttentionItem[] = [
    {
      href: '/admin/contact-messages',
      label: 'Open cases',
      value: badgeCounts['/admin/contact-messages'] ?? 0,
      tone: 'rose',
    },
    {
      href: isAdmin ? '/admin/shipping' : '/admin/home',
      label: 'Label failures',
      value: badgeCounts['/admin/shipping'] ?? 0,
      tone: 'rose',
    },
    {
      href: '/admin/we-buy',
      label: 'Buy program queue',
      value: badgeCounts['/admin/we-buy'] ?? 0,
      tone: 'slate',
    },
    {
      href: '/admin/careers',
      label: 'Career applications',
      value: badgeCounts['/admin/careers'] ?? 0,
      tone: 'amber',
    },
    {
      href: '/admin/listings/hidden',
      label: 'Hidden listings',
      value: badgeCounts['/admin/listings/hidden'] ?? 0,
      tone: 'slate',
    },
    {
      href: isAdmin ? '/admin/listings/brand-requests' : '/admin/home',
      label: 'Brand requests',
      value: badgeCounts['/admin/listings/brand-requests'] ?? 0,
      tone: 'slate',
    },
  ].filter((item) => item.value > 0)

  if (items.length === 0) {
    return (
      <aside>
        <section className="admin-surface p-5">
          <p className="text-sm font-semibold text-foreground">Needs attention</p>
          <p className="mt-3 text-sm text-muted-foreground">Nothing waiting in the queues.</p>
        </section>
      </aside>
    )
  }

  return (
    <aside>
      <section className="admin-surface p-5">
        <p className="text-sm font-semibold text-foreground">Needs attention</p>
        <p className="mt-1 text-xs text-muted-foreground">Support, shipping labels, and buy-program work.</p>
        <ul className="mt-4 space-y-2.5">
          {items.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-3 rounded-lg px-1 py-0.5 hover:bg-slate-50"
              >
                <span className="text-sm text-foreground">{item.label}</span>
                <span
                  className={cn(
                    'min-w-7 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums',
                    item.tone === 'rose' && 'bg-rose-50 text-rose-700',
                    item.tone === 'amber' && 'bg-amber-50 text-amber-800',
                    item.tone === 'slate' && 'bg-slate-100 text-slate-700',
                  )}
                >
                  {formatCount(item.value)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}
