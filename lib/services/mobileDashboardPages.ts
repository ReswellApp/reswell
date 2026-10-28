import type { MobileDashboardPage } from "@reswell/api-contract"

export interface MobileDashboardPageAccess {
  isAdmin: boolean
  isShipper: boolean
  hasShopifyAccess: boolean
  hasSellerProfile: boolean
}

/**
 * Me destinations every signed-in member can use on mobile.
 * Shipper, Shopify, and Balance Sheet stay on the website — those are extra-permission
 * tools, not the mobile account surface.
 */
export function mobileDashboardPages(access: MobileDashboardPageAccess): MobileDashboardPage[] {
  return [
    { id: "overview", label: "Overview" },
    { id: "profile", label: "Profile" },
    { id: "earnings", label: "Earnings" },
    { id: "listings", label: "My Listings" },
    { id: "offers", label: "Offers" },
    { id: "messages", label: "Messages" },
    { id: "support", label: "Reswell help" },
    { id: "purchases", label: "Purchases" },
    { id: "sales", label: "Sales" },
    { id: "favorites", label: "Favorites" },
    { id: "following", label: "Following" },
    ...(access.hasSellerProfile ? [{ id: "seller-profile" as const, label: "My Seller Profile" }] : []),
  ]
}
