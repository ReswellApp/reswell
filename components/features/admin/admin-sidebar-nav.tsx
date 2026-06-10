'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  Users,
  MessageSquare,
  Settings,
  Activity,
  Tag,
  Truck,
  LifeBuoy,
  Shield,
  ShoppingBag,
  ShoppingCart,
  LineChart,
  Layers,
  FolderTree,
  Waves,
  Wallet,
  ChevronDown,
  Target,
  ContactRound,
  Search,
  Wrench,
  DollarSign,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type {
  AdminNavGroupConfig,
  AdminNavIconKey,
} from '@/lib/admin-nav'
import type { AdminNavBadgeCounts } from '@/lib/db/adminNavCounts'
import { sumAdminNavBadgeCounts } from '@/lib/db/adminNavCounts'
import { NavUnreadCountBadge } from '@/components/nav-unread-count-badge'

const NAV_ICONS: Record<AdminNavIconKey, LucideIcon> = {
  layoutDashboard: LayoutDashboard,
  waves: Waves,
  activity: Activity,
  lineChart: LineChart,
  package: Package,
  layers: Layers,
  folderTree: FolderTree,
  tag: Tag,
  users: Users,
  wallet: Wallet,
  shoppingBag: ShoppingBag,
  shoppingCart: ShoppingCart,
  lifeBuoy: LifeBuoy,
  messageSquare: MessageSquare,
  shield: Shield,
  truck: Truck,
  settings: Settings,
  target: Target,
  contactRound: ContactRound,
  search: Search,
  wrench: Wrench,
  dollarSign: DollarSign,
}

function isNavActive(pathname: string, href: string): boolean {
  const norm = pathname.replace(/\/$/, '') || '/'
  if (href === '/admin') {
    return norm === '/admin'
  }
  return norm === href || norm.startsWith(`${href}/`)
}

interface AdminSidebarNavProps {
  groups: AdminNavGroupConfig[]
  badgeCounts?: AdminNavBadgeCounts
}

export function AdminSidebarNav({ groups, badgeCounts = {} }: AdminSidebarNavProps) {
  const pathname = usePathname() ?? ''

  return (
    <div className="space-y-2" key={pathname}>
      {groups.map((group) => {
        const isOpen = group.items.some((item) =>
          isNavActive(pathname, item.href),
        )
        const groupBadgeCount = sumAdminNavBadgeCounts(
          badgeCounts,
          group.items.map((item) => item.href),
        )
        return (
          <Collapsible key={group.id} defaultOpen={isOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex h-9 w-full items-center justify-between gap-2 px-3 font-semibold text-foreground hover:bg-secondary data-[state=open]:[&_.admin-nav-chevron]:rotate-180"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate">{group.label}</span>
                  <NavUnreadCountBadge count={groupBadgeCount} />
                </span>
                <ChevronDown className="admin-nav-chevron h-4 w-4 shrink-0 transition-transform duration-200" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 pt-1 pl-1">
              {group.items.map((item) => {
                const Icon = NAV_ICONS[item.icon]
                const active = isNavActive(pathname, item.href)
                const itemBadgeCount = badgeCounts[item.href] ?? 0
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full justify-between gap-2 font-normal',
                        active && 'bg-secondary text-foreground',
                      )}
                    >
                      <span className="flex min-w-0 items-center">
                        <Icon className="mr-3 h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <NavUnreadCountBadge count={itemBadgeCount} />
                    </Button>
                  </Link>
                )
              })}
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}
