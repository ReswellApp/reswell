import {
  Activity,
  BellRing,
  Brain,
  Code,
  ContactRound,
  DollarSign,
  FileText,
  FolderTree,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  MapPin,
  Megaphone,
  MessageSquare,
  Package,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  Target,
  Ticket,
  Truck,
  Users,
  Wallet,
  Waves,
  Wrench,
} from 'lucide-react'
import type { AdminNavIconKey } from '@/lib/admin-nav'
import { cn } from '@/lib/utils'

export function AdminHomeIcon({
  icon,
  className,
}: {
  icon: AdminNavIconKey
  className?: string
}) {
  const iconClassName = cn('h-4 w-4 shrink-0', className)
  switch (icon) {
    case 'layoutDashboard':
      return <LayoutDashboard className={iconClassName} aria-hidden />
    case 'waves':
      return <Waves className={iconClassName} aria-hidden />
    case 'activity':
    case 'activityPulse':
      return <Activity className={iconClassName} aria-hidden />
    case 'lineChart':
      return <LineChart className={iconClassName} aria-hidden />
    case 'package':
      return <Package className={iconClassName} aria-hidden />
    case 'layers':
      return <Layers className={iconClassName} aria-hidden />
    case 'folderTree':
      return <FolderTree className={iconClassName} aria-hidden />
    case 'tag':
      return <Tag className={iconClassName} aria-hidden />
    case 'users':
      return <Users className={iconClassName} aria-hidden />
    case 'wallet':
      return <Wallet className={iconClassName} aria-hidden />
    case 'shoppingBag':
      return <ShoppingBag className={iconClassName} aria-hidden />
    case 'shoppingCart':
      return <ShoppingCart className={iconClassName} aria-hidden />
    case 'store':
      return <Store className={iconClassName} aria-hidden />
    case 'lifeBuoy':
      return <LifeBuoy className={iconClassName} aria-hidden />
    case 'messageSquare':
      return <MessageSquare className={iconClassName} aria-hidden />
    case 'shield':
      return <Shield className={iconClassName} aria-hidden />
    case 'truck':
      return <Truck className={iconClassName} aria-hidden />
    case 'settings':
      return <Settings className={iconClassName} aria-hidden />
    case 'target':
      return <Target className={iconClassName} aria-hidden />
    case 'contactRound':
      return <ContactRound className={iconClassName} aria-hidden />
    case 'search':
      return <Search className={iconClassName} aria-hidden />
    case 'wrench':
      return <Wrench className={iconClassName} aria-hidden />
    case 'dollarSign':
      return <DollarSign className={iconClassName} aria-hidden />
    case 'sparkles':
      return <Sparkles className={iconClassName} aria-hidden />
    case 'fileText':
      return <FileText className={iconClassName} aria-hidden />
    case 'brain':
      return <Brain className={iconClassName} aria-hidden />
    case 'megaphone':
      return <Megaphone className={iconClassName} aria-hidden />
    case 'mapPin':
      return <MapPin className={iconClassName} aria-hidden />
    case 'ticket':
      return <Ticket className={iconClassName} aria-hidden />
    case 'bellRing':
      return <BellRing className={iconClassName} aria-hidden />
    case 'code':
      return <Code className={iconClassName} aria-hidden />
    case 'rotateCcw':
      return <RotateCcw className={iconClassName} aria-hidden />
    default:
      return <LayoutDashboard className={iconClassName} aria-hidden />
  }
}
