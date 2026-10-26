import type { Href } from "expo-router"
import type { MobileDashboardPageId } from "@reswell/api-contract"

/** In-app destination for a dashboard page returned by `/api/mobile/v1/me/dashboard`. */
export function dashboardPageHref(id: MobileDashboardPageId, sellerSlug: string | null): Href | null {
  switch (id) {
    case "overview":
      return "/account"
    case "shipper":
      return "/account/shipper"
    case "profile":
      return "/account/profile"
    case "earnings":
      return "/account/earnings"
    case "balance-sheet":
      return "/account/balance-sheet"
    case "listings":
      return "/account/listings"
    case "shopify":
      return "/account/shopify"
    case "offers":
      return "/account/offers"
    case "messages":
      return "/account/messages"
    case "support":
      return "/account/support"
    case "purchases":
      return "/account/purchases"
    case "sales":
      return "/account/sales"
    case "favorites":
      return "/account/favorites"
    case "following":
      return "/account/following"
    case "seller-profile":
      return sellerSlug ? { pathname: "/profile/[slug]", params: { slug: sellerSlug } } : null
    default: {
      const unreachable: never = id
      return unreachable
    }
  }
}
