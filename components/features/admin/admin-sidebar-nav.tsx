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
  Store,
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
  BellRing,
  Code,
  RotateCcw,
  Sparkles,
  FileText,
  Brain,
  Megaphone,
  MapPin,
  Ticket,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { AdminNavGroupConfig, AdminNavIconKey } from '@/lib/admin-nav'
import type { AdminNavBadgeCounts } from '@/lib/admin-nav-badge-counts'
import { sumAdminNavBadgeCounts } from '@/lib/admin-nav-badge-counts'
import { NavUnreadCountBadge } from '@/components/nav-unread-count-badge'

const NAV_ICON_CLASS = 'mr-3 h-4 w-4 shrink-0'

function AdminNavItemIcon({ icon }: { icon: AdminNavIconKey }) {
  switch (icon) {
    case 'layoutDashboard':
      return <LayoutDashboard className={NAV_ICON_CLASS} aria-hidden />
    case 'waves':
      return <Waves className={NAV_ICON_CLASS} aria-hidden />
    case 'activity':
    case 'activityPulse':
      return <Activity className={NAV_ICON_CLASS} aria-hidden />
    case 'lineChart':
      return <LineChart className={NAV_ICON_CLASS} aria-hidden />
    case 'package':
      return <Package className={NAV_ICON_CLASS} aria-hidden />
    case 'layers':
      return <Layers className={NAV_ICON_CLASS} aria-hidden />
    case 'folderTree':
      return <FolderTree className={NAV_ICON_CLASS} aria-hidden />
    case 'tag':
      return <Tag className={NAV_ICON_CLASS} aria-hidden />
    case 'users':
      return <Users className={NAV_ICON_CLASS} aria-hidden />
    case 'wallet':
      return <Wallet className={NAV_ICON_CLASS} aria-hidden />
    case 'shoppingBag':
      return <ShoppingBag className={NAV_ICON_CLASS} aria-hidden />
    case 'shoppingCart':
      return <ShoppingCart className={NAV_ICON_CLASS} aria-hidden />
    case 'store':
      return <Store className={NAV_ICON_CLASS} aria-hidden />
    case 'lifeBuoy':
      return <LifeBuoy className={NAV_ICON_CLASS} aria-hidden />
    case 'messageSquare':
      return <MessageSquare className={NAV_ICON_CLASS} aria-hidden />
    case 'shield':
      return <Shield className={NAV_ICON_CLASS} aria-hidden />
    case 'truck':
      return <Truck className={NAV_ICON_CLASS} aria-hidden />
    case 'settings':
      return <Settings className={NAV_ICON_CLASS} aria-hidden />
    case 'target':
      return <Target className={NAV_ICON_CLASS} aria-hidden />
    case 'contactRound':
      return <ContactRound className={NAV_ICON_CLASS} aria-hidden />
    case 'search':
      return <Search className={NAV_ICON_CLASS} aria-hidden />
    case 'wrench':
      return <Wrench className={NAV_ICON_CLASS} aria-hidden />
    case 'dollarSign':
      return <DollarSign className={NAV_ICON_CLASS} aria-hidden />
    case 'sparkles':
      return <Sparkles className={NAV_ICON_CLASS} aria-hidden />
    case 'fileText':
      return <FileText className={NAV_ICON_CLASS} aria-hidden />
    case 'brain':
      return <Brain className={NAV_ICON_CLASS} aria-hidden />
    case 'megaphone':
      return <Megaphone className={NAV_ICON_CLASS} aria-hidden />
    case 'mapPin':
      return <MapPin className={NAV_ICON_CLASS} aria-hidden />
    case 'ticket':
      return <Ticket className={NAV_ICON_CLASS} aria-hidden />
    case 'bellRing':
      return <BellRing className={NAV_ICON_CLASS} aria-hidden />
    case 'code':
      return <Code className={NAV_ICON_CLASS} aria-hidden />
    case 'rotateCcw':
      return <RotateCcw className={NAV_ICON_CLASS} aria-hidden />
    default:
      return <LayoutDashboard className={NAV_ICON_CLASS} aria-hidden />
  }
}

function isNavActive(pathname: string, href: string): boolean {
  const norm = pathname.replace(/\/$/, '') || '/'
  // Exact-only for home/overview roots so they don't steal child routes.
  if (href === '/admin/home' || href === '/admin/overview') {
    return norm === href
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
        const groupBadgeCount = sumAdminNavBadgeCounts(
          badgeCounts,
          group.items.map((item) => item.href),
        )
        return (
          <Collapsible key={group.id} defaultOpen={false}>
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
                        <AdminNavItemIcon icon={item.icon} />
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
