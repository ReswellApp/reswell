"use client"

import { usePathname } from "next/navigation"
import { DashboardMobilePageChrome } from "@/components/features/dashboard/dashboard-mobile-page-chrome"
import { isMessageThreadDetailRoute } from "@/lib/utils/message-thread-routes"

export function MessagesAccountMobileChrome({
  sellerProfileHref,
  isAdmin = false,
  isShipper = false,
  isDropoffLocation = false,
  hasShopifyAccess,
}: {
  sellerProfileHref: string | null
  isAdmin?: boolean
  isShipper?: boolean
  isDropoffLocation?: boolean
  hasShopifyAccess: boolean
}) {
  const pathname = usePathname() ?? ""

  if (isMessageThreadDetailRoute(pathname)) {
    return null
  }

  return (
    <DashboardMobilePageChrome
      sellerProfileHref={sellerProfileHref}
      isAdmin={isAdmin}
      isShipper={isShipper}
      isDropoffLocation={isDropoffLocation}
      hasShopifyAccess={hasShopifyAccess}
    />
  )
}
