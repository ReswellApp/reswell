import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  CreditCard,
  ClipboardList,
  Tag,
  QrCode,
  HandCoins,
  MessageSquare,
  Users,
  Settings,
  Contact,
  UserCircle,
  Banknote,
  Package,
  Handshake,
  ShoppingBag,
  PackageCheck,
} from "lucide-react"
import type { ConsignmentStoreStaffRole } from "@/lib/types/consignment"

export type StoreNavMinRole = "clerk" | "manager" | "owner"

export interface StoreNavLink {
  name: string
  /** Path after `/stores/{slug}` — e.g. `/dashboard` */
  path: string
  icon: LucideIcon
  /** Minimum role required (clerk = all staff). */
  minRole: StoreNavMinRole
}

export interface StoreNavSection {
  label: string
  items: StoreNavLink[]
}

const ROLE_RANK: Record<ConsignmentStoreStaffRole, number> = {
  clerk: 0,
  manager: 1,
  owner: 2,
}

export function storeNavHref(slug: string, path: string): string {
  return `/stores/${slug}${path}`
}

export function canAccessStoreNavItem(
  role: ConsignmentStoreStaffRole,
  minRole: StoreNavMinRole,
): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole]
}

/** Consignment shop operator navigation — sidebar + mobile menu. */
export function buildStoreNavSections(): StoreNavSection[] {
  return [
    {
      label: "Operations",
      items: [
        { name: "Overview", path: "/dashboard", icon: LayoutDashboard, minRole: "clerk" },
        { name: "Register", path: "/pos", icon: CreditCard, minRole: "clerk" },
      ],
    },
    {
      label: "Inventory",
      items: [
        { name: "Intake approvals", path: "/intake", icon: ClipboardList, minRole: "clerk" },
        { name: "Inventory", path: "/inventory", icon: Tag, minRole: "clerk" },
        { name: "Intake QR", path: "/qr", icon: QrCode, minRole: "clerk" },
      ],
    },
    {
      label: "Buyers",
      items: [
        { name: "Customers", path: "/customers", icon: Contact, minRole: "clerk" },
        { name: "Shop offers", path: "/offers", icon: HandCoins, minRole: "clerk" },
        { name: "Shop messages", path: "/messages", icon: MessageSquare, minRole: "clerk" },
      ],
    },
    {
      label: "Account",
      items: [
        { name: "Overview", path: "/account", icon: LayoutDashboard, minRole: "clerk" },
        { name: "Profile", path: "/account/profile", icon: UserCircle, minRole: "clerk" },
        { name: "Earnings", path: "/account/earnings", icon: Banknote, minRole: "clerk" },
        { name: "My listings", path: "/account/listings", icon: Package, minRole: "clerk" },
        { name: "Offers", path: "/account/offers", icon: Handshake, minRole: "clerk" },
        { name: "Messages", path: "/account/messages", icon: MessageSquare, minRole: "clerk" },
        { name: "Purchases", path: "/account/purchases", icon: ShoppingBag, minRole: "clerk" },
        { name: "Sales", path: "/account/sales", icon: PackageCheck, minRole: "clerk" },
        { name: "Following", path: "/account/following", icon: Users, minRole: "clerk" },
        { name: "My consignments", path: "/account/consignments", icon: ClipboardList, minRole: "clerk" },
      ],
    },
    {
      label: "Administration",
      items: [
        { name: "Team", path: "/team", icon: Users, minRole: "owner" },
        { name: "Settings", path: "/settings", icon: Settings, minRole: "owner" },
      ],
    },
  ]
}

export function filterStoreNavSections(
  sections: StoreNavSection[],
  role: ConsignmentStoreStaffRole,
): StoreNavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessStoreNavItem(role, item.minRole)),
    }))
    .filter((section) => section.items.length > 0)
}
