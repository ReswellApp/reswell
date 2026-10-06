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
  Scale,
  Truck,
} from "lucide-react"

export interface DashboardNavChildLink {
  name: string
  href: string
}

export interface DashboardNavLink {
  name: string
  href: string
  icon: LucideIcon
  adminOnly?: boolean
  children?: DashboardNavChildLink[]
}

export const DASHBOARD_MESSAGES_NAV: DashboardNavLink = {
  name: "Messages",
  href: "/messages",
  icon: MessageSquare,
}

export const DASHBOARD_SHIPPER_NAV: DashboardNavLink = {
  name: "Shipper",
  href: "/dashboard/shipper",
  icon: Truck,
}

export function dashboardNavLinks(input: { isAdmin: boolean; isShipper: boolean }): DashboardNavLink[] {
  const links = DASHBOARD_NAV_LINKS.filter((link) => !link.adminOnly || input.isAdmin)
  if (!input.isShipper) return links
  const [overview, ...rest] = links
  return overview ? [overview, DASHBOARD_SHIPPER_NAV, ...rest] : [DASHBOARD_SHIPPER_NAV]
}

export const DASHBOARD_NAV_LINKS: DashboardNavLink[] = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Profile", href: "/dashboard/profile", icon: UserCircle },
  { name: "Earnings", href: "/dashboard/earnings", icon: Banknote },
  {
    name: "Balance Sheet",
    href: "/dashboard/balance-sheet",
    icon: Scale,
    adminOnly: true,
  },
  { name: "My Listings", href: "/dashboard/listings", icon: Package },
  { name: "Offers", href: "/dashboard/offers", icon: Handshake },
  DASHBOARD_MESSAGES_NAV,
  { name: "Support", href: "/dashboard/support", icon: LifeBuoy },
  { name: "Purchases", href: "/dashboard/purchases", icon: ShoppingBag },
  { name: "Sales", href: "/dashboard/sales", icon: PackageCheck },
  { name: "Favorites", href: "/dashboard/favorites", icon: Heart },
  { name: "Following", href: "/dashboard/following", icon: Users },
]
