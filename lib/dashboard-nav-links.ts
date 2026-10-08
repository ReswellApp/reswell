import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Banknote,
  Handshake,
  Heart,
  MapPin,
  Package,
  ShoppingBag,
  PackageCheck,
  UserCircle,
  Users,
  MessageSquare,
  LifeBuoy,
  Scale,
  Store,
  Truck,
} from "lucide-react"
import { insertNavLinkAfter } from "@/lib/dashboard-nav-order"

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

export const DASHBOARD_DROPOFF_LOCATION_NAV: DashboardNavLink = {
  name: "Drop-off",
  href: "/dashboard/dropoff-location",
  icon: MapPin,
}

export const DASHBOARD_SHOPIFY_NAV: DashboardNavLink = {
  name: "Shopify",
  href: "/dashboard/shopify",
  icon: Store,
}

export function dashboardNavLinks(input: {
  isAdmin: boolean
  isShipper: boolean
  isDropoffLocation?: boolean
  hasShopifyAccess?: boolean
}): DashboardNavLink[] {
  const links = DASHBOARD_NAV_LINKS.filter((link) => !link.adminOnly || input.isAdmin)
  let expanded = input.hasShopifyAccess
    ? links.flatMap((link) =>
        link.href === "/dashboard/listings"
          ? [link, DASHBOARD_SHOPIFY_NAV]
          : [link],
      )
    : links
  if (input.isShipper) {
    expanded = insertNavLinkAfter(expanded, DASHBOARD_SHIPPER_NAV, "/dashboard")
  }
  if (input.isDropoffLocation) {
    expanded = insertNavLinkAfter(
      expanded,
      DASHBOARD_DROPOFF_LOCATION_NAV,
      input.isShipper ? "/dashboard/shipper" : "/dashboard",
    )
  }
  return expanded
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
