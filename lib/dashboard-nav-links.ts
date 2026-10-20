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
  /** Stable id when href alone is not unique (e.g. Offers in Selling and Buying). */
  id?: string
}

export type DashboardNavSectionId = "selling" | "buying" | "account"

export interface DashboardNavSection {
  id: DashboardNavSectionId
  label: string
  links: DashboardNavLink[]
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

const SELLING_OFFERS_NAV: DashboardNavLink = {
  id: "offers-selling",
  name: "Offers",
  href: "/dashboard/offers",
  icon: Handshake,
}

const BUYING_OFFERS_NAV: DashboardNavLink = {
  id: "offers-buying",
  name: "Offers",
  href: "/dashboard/offers?tab=buyer",
  icon: Handshake,
}

export interface DashboardNavLinksInput {
  isAdmin: boolean
  isShipper: boolean
  isDropoffLocation?: boolean
  hasShopifyAccess?: boolean
  showEarnings?: boolean
}

function buildSellingLinks(input: DashboardNavLinksInput): DashboardNavLink[] {
  const links: DashboardNavLink[] = [
    { name: "Listings", href: "/dashboard/listings", icon: Package },
    SELLING_OFFERS_NAV,
    { name: "Sales", href: "/dashboard/sales", icon: PackageCheck },
  ]

  if (input.showEarnings !== false) {
    links.push({ name: "Earnings", href: "/dashboard/earnings", icon: Banknote })
  }

  if (input.hasShopifyAccess) {
    links.push(DASHBOARD_SHOPIFY_NAV)
  }

  if (input.isAdmin) {
    links.push({
      name: "Balance Sheet",
      href: "/dashboard/balance-sheet",
      icon: Scale,
      adminOnly: true,
    })
  }

  if (input.isShipper) {
    links.push(DASHBOARD_SHIPPER_NAV)
  }

  if (input.isDropoffLocation) {
    links.push(DASHBOARD_DROPOFF_LOCATION_NAV)
  }

  return links
}

const BUYING_LINKS: DashboardNavLink[] = [
  { name: "Purchases", href: "/dashboard/purchases", icon: ShoppingBag },
  BUYING_OFFERS_NAV,
  { name: "Favorites", href: "/dashboard/favorites", icon: Heart },
  { name: "Following", href: "/dashboard/following", icon: Users },
]

const ACCOUNT_LINKS: DashboardNavLink[] = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Profile", href: "/dashboard/profile", icon: UserCircle },
  DASHBOARD_MESSAGES_NAV,
  { name: "Support", href: "/dashboard/support", icon: LifeBuoy },
]

/** Grouped nav for sidebar / mobile / account menu (Pango-style Selling / Buying / Account). */
export function dashboardNavSections(input: DashboardNavLinksInput): DashboardNavSection[] {
  return [
    { id: "selling", label: "Selling", links: buildSellingLinks(input) },
    { id: "buying", label: "Buying", links: BUYING_LINKS },
    { id: "account", label: "Account", links: ACCOUNT_LINKS },
  ]
}

/** Flat list for callers that do not need section headers. */
export function dashboardNavLinks(input: DashboardNavLinksInput): DashboardNavLink[] {
  return dashboardNavSections(input).flatMap((section) => section.links)
}

/** @deprecated Prefer `dashboardNavSections` / `dashboardNavLinks`. Kept for tests that assert base items. */
export const DASHBOARD_NAV_LINKS: DashboardNavLink[] = [
  { name: "Listings", href: "/dashboard/listings", icon: Package },
  SELLING_OFFERS_NAV,
  { name: "Sales", href: "/dashboard/sales", icon: PackageCheck },
  { name: "Earnings", href: "/dashboard/earnings", icon: Banknote },
  {
    name: "Balance Sheet",
    href: "/dashboard/balance-sheet",
    icon: Scale,
    adminOnly: true,
  },
  { name: "Purchases", href: "/dashboard/purchases", icon: ShoppingBag },
  BUYING_OFFERS_NAV,
  { name: "Favorites", href: "/dashboard/favorites", icon: Heart },
  { name: "Following", href: "/dashboard/following", icon: Users },
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Profile", href: "/dashboard/profile", icon: UserCircle },
  DASHBOARD_MESSAGES_NAV,
  { name: "Support", href: "/dashboard/support", icon: LifeBuoy },
]
