"use client"

import { usePathname } from "next/navigation"
import { DashboardMobilePageChrome } from "@/components/features/dashboard/dashboard-mobile-page-chrome"
import { isMessageThreadDetailRoute } from "@/lib/utils/message-thread-routes"

export function MessagesAccountMobileChrome({
  sellerProfileHref,
  storeHubHref,
  storeHubName,
}: {
  sellerProfileHref: string | null
  storeHubHref?: string | null
  storeHubName?: string | null
}) {
  const pathname = usePathname() ?? ""

  if (isMessageThreadDetailRoute(pathname)) {
    return null
  }

  return (
    <DashboardMobilePageChrome
      sellerProfileHref={sellerProfileHref}
      storeHubHref={storeHubHref}
      storeHubName={storeHubName}
    />
  )
}
