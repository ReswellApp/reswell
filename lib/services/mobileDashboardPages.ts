import type { MobileDashboardPage } from "@reswell/api-contract"

export interface MobileDashboardPageAccess {
  isAdmin: boolean
  isShipper: boolean
  hasShopifyAccess: boolean
  hasSellerProfile: boolean
}

/**
 * Same order and permission rules as the website dashboard sidebar.
 * Shipper follows Overview. Shopify follows My Listings. Balance Sheet is admin-only.
 * A shop account also gets My Seller Profile.
 */
export function mobileDashboardPages(access: MobileDashboardPageAccess): MobileDashboardPage[] {
  const pages: MobileDashboardPage[] = [
    { id: "overview", label: "Overview" },
    { id: "profile", label: "Profile" },
    { id: "earnings", label: "Earnings" },
    ...(access.isAdmin ? [{ id: "balance-sheet" as const, label: "Balance Sheet" }] : []),
    { id: "listings", label: "My Listings" },
    ...(access.hasShopifyAccess ? [{ id: "shopify" as const, label: "Shopify" }] : []),
    { id: "offers", label: "Offers" },
    { id: "messages", label: "Messages" },
    { id: "support", label: "Reswell help" },
    { id: "purchases", label: "Purchases" },
    { id: "sales", label: "Sales" },
    { id: "favorites", label: "Favorites" },
    { id: "following", label: "Following" },
    ...(access.hasSellerProfile ? [{ id: "seller-profile" as const, label: "My Seller Profile" }] : []),
  ]
  if (!access.isShipper) return pages
  const [overview, ...rest] = pages
  return overview ? [overview, { id: "shipper", label: "Shipper" }, ...rest] : pages
}
