import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Banknote,
  Handshake,
  Package,
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
  { name: "Earnings", href: "/dashboard/earnings", icon: Banknote },
  { name: "My Listings", href: "/dashboard/listings", icon: Package },
  { name: "Orders", href: "/dashboard/orders", icon: ShoppingBag },
  { name: "Sales", href: "/dashboard/sales", icon: PackageCheck },
  { name: "Offers", href: "/dashboard/offers", icon: Handshake },
  { name: "Profile", href: "/dashboard/profile", icon: UserCircle },
]
