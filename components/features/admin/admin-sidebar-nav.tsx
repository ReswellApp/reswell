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
  BookOpen,
  Handshake,
} from 'lucide-react'
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

const NAV_ICON_CLASS = 'mr-2.5 h-4 w-4 shrink-0'

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
    case 'bookOpen':
      return <BookOpen className={NAV_ICON_CLASS} aria-hidden />
    case 'handshake':
      return <Handshake className={NAV_ICON_CLASS} aria-hidden />
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
  const hrefPath = href.split('?')[0] || href
  if (hrefPath === '/admin/home' || hrefPath === '/admin/shop') {
    return norm === hrefPath
  }
  return norm === hrefPath || norm.startsWith(`${hrefPath}/`)
}

interface AdminSidebarNavProps {
  groups: AdminNavGroupConfig[]
  badgeCounts?: AdminNavBadgeCounts
  pathname?: string
  onNavigate?: () => void
  forceOpen?: boolean
}

export function AdminSidebarNav({
  groups,
  badgeCounts = {},
  pathname: pathnameProp,
  onNavigate,
  forceOpen = false,
}: AdminSidebarNavProps) {
  const routedPathname = usePathname() ?? ''
  const pathname = pathnameProp ?? routedPathname

  return (
    <div className="space-y-3" key={`${pathname}-${forceOpen ? 'search' : 'browse'}`}>
      {groups.map((group) => {
        const groupBadgeCount = sumAdminNavBadgeCounts(
          badgeCounts,
          group.items.map((item) => item.href),
        )
        const groupActive = group.items.some((item) => isNavActive(pathname, item.href))
        return (
          <Collapsible key={group.id} defaultOpen={forceOpen || groupActive}>
            <CollapsibleTrigger className="flex h-8 w-full items-center justify-between gap-2 rounded-lg px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground data-[state=open]:[&_.admin-nav-chevron]:rotate-180">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate">{group.label}</span>
                <NavUnreadCountBadge count={groupBadgeCount} className="h-4 min-w-4 text-[10px]" />
              </span>
              <ChevronDown className="admin-nav-chevron h-3.5 w-3.5 shrink-0 transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 pt-1">
              {group.items.map((item) => {
                const active = isNavActive(pathname, item.href)
                const itemBadgeCount = badgeCounts[item.href] ?? 0
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors',
                      active
                        ? 'bg-slate-100 font-medium text-foreground dark:bg-muted'
                        : 'font-normal text-slate-600 hover:bg-slate-50 hover:text-foreground dark:text-muted-foreground dark:hover:bg-muted',
                    )}
                  >
                    <span className="flex min-w-0 items-center">
                      <AdminNavItemIcon icon={item.icon} />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <NavUnreadCountBadge count={itemBadgeCount} className="h-4 min-w-4 text-[10px]" />
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
