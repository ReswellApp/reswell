import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Package,
  Banknote,
  Users,
  Handshake,
  ShoppingBag,
  PackageCheck,
  UserCircle,
} from "lucide-react"

export interface DashboardNavLink {
  name: string
  href: string
  icon: LucideIcon
}

export const DASHBOARD_NAV_LINKS: DashboardNavLink[] = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "My Listings", href: "/dashboard/listings", icon: Package },
  { name: "Earnings", href: "/dashboard/earnings", icon: Banknote },
  { name: "Followers", href: "/dashboard/followers", icon: Users },
  { name: "Offers", href: "/dashboard/offers", icon: Handshake },
  { name: "Orders", href: "/dashboard/orders", icon: ShoppingBag },
  { name: "Sales", href: "/dashboard/sales", icon: PackageCheck },
  { name: "Profile", href: "/dashboard/profile", icon: UserCircle },
]
