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
  ShoppingBag,
  LineChart,
  Layers,
  FolderTree,
  Waves,
  ChevronDown,
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
  shoppingBag: ShoppingBag,
  lifeBuoy: LifeBuoy,
  messageSquare: MessageSquare,
  truck: Truck,
  settings: Settings,
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
}

export function AdminSidebarNav({ groups }: AdminSidebarNavProps) {
  const pathname = usePathname() ?? ''

  return (
    <div className="space-y-2" key={pathname}>
      {groups.map((group) => {
        const isOpen = group.items.some((item) =>
          isNavActive(pathname, item.href),
        )
        return (
          <Collapsible key={group.id} defaultOpen={isOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex h-9 w-full items-center justify-between px-3 font-semibold text-foreground hover:bg-secondary data-[state=open]:[&_.admin-nav-chevron]:rotate-180"
              >
                <span>{group.label}</span>
                <ChevronDown className="admin-nav-chevron h-4 w-4 shrink-0 transition-transform duration-200" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 pt-1 pl-1">
              {group.items.map((item) => {
                const Icon = NAV_ICONS[item.icon]
                const active = isNavActive(pathname, item.href)
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full justify-start font-normal',
                        active && 'bg-secondary text-foreground',
                      )}
                    >
                      <Icon className="mr-3 h-4 w-4 shrink-0" />
                      {item.label}
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
