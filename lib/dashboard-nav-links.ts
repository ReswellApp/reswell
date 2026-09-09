import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Banknote,
  Handshake,
  Heart,
  Package,
  ShoppingBag,
  PackageCheck,
  UserCircle,
  Users,
  MessageSquare,
  LifeBuoy,
} from "lucide-react"

export interface DashboardNavChildLink {
  name: string
  href: string
}

export interface DashboardNavLink {
  name: string
  href: string
  icon: LucideIcon
  children?: DashboardNavChildLink[]
}

export const DASHBOARD_MESSAGES_NAV: DashboardNavLink = {
  name: "Messages",
  href: "/messages",
  icon: MessageSquare,
}

export const DASHBOARD_NAV_LINKS: DashboardNavLink[] = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Profile", href: "/dashboard/profile", icon: UserCircle },
  { name: "Earnings", href: "/dashboard/earnings", icon: Banknote },
  { name: "My Listings", href: "/dashboard/listings", icon: Package },
  { name: "Offers", href: "/dashboard/offers", icon: Handshake },
  DASHBOARD_MESSAGES_NAV,
  { name: "Support", href: "/dashboard/support", icon: LifeBuoy },
  { name: "Purchases", href: "/dashboard/purchases", icon: ShoppingBag },
  { name: "Sales", href: "/dashboard/sales", icon: PackageCheck },
  { name: "Favorites", href: "/dashboard/favorites", icon: Heart },
  { name: "Following", href: "/dashboard/following", icon: Users },
]
