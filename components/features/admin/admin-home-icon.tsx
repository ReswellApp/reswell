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
  Truck,
  Users,
  Wallet,
  Waves,
  Wrench,
} from 'lucide-react'
import type { AdminNavIconKey } from '@/lib/admin-nav'

export function AdminHomeIcon({ icon }: { icon: AdminNavIconKey }) {
  const className = 'h-4 w-4 shrink-0'
  switch (icon) {
    case 'layoutDashboard':
      return <LayoutDashboard className={className} aria-hidden />
    case 'waves':
      return <Waves className={className} aria-hidden />
    case 'activity':
    case 'activityPulse':
      return <Activity className={className} aria-hidden />
    case 'lineChart':
      return <LineChart className={className} aria-hidden />
    case 'package':
      return <Package className={className} aria-hidden />
    case 'layers':
      return <Layers className={className} aria-hidden />
    case 'folderTree':
      return <FolderTree className={className} aria-hidden />
    case 'tag':
      return <Tag className={className} aria-hidden />
    case 'users':
      return <Users className={className} aria-hidden />
    case 'wallet':
      return <Wallet className={className} aria-hidden />
    case 'shoppingBag':
      return <ShoppingBag className={className} aria-hidden />
    case 'shoppingCart':
      return <ShoppingCart className={className} aria-hidden />
    case 'store':
      return <Store className={className} aria-hidden />
    case 'messageSquare':
      return <MessageSquare className={className} aria-hidden />
    case 'shield':
      return <Shield className={className} aria-hidden />
    case 'truck':
      return <Truck className={className} aria-hidden />
    case 'settings':
      return <Settings className={className} aria-hidden />
    case 'target':
      return <Target className={className} aria-hidden />
    case 'contactRound':
      return <ContactRound className={className} aria-hidden />
    case 'search':
      return <Search className={className} aria-hidden />
    case 'wrench':
      return <Wrench className={className} aria-hidden />
    case 'dollarSign':
      return <DollarSign className={className} aria-hidden />
    case 'sparkles':
      return <Sparkles className={className} aria-hidden />
    case 'fileText':
      return <FileText className={className} aria-hidden />
    case 'brain':
      return <Brain className={className} aria-hidden />
    case 'megaphone':
      return <Megaphone className={className} aria-hidden />
    case 'mapPin':
      return <MapPin className={className} aria-hidden />
    case 'bellRing':
      return <BellRing className={className} aria-hidden />
    case 'code':
      return <Code className={className} aria-hidden />
    case 'rotateCcw':
      return <RotateCcw className={className} aria-hidden />
    default:
      return <LayoutDashboard className={className} aria-hidden />
  }
}
