"use client"

import { Suspense } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { DashboardMobileNav } from "@/components/features/dashboard/dashboard-mobile-nav"
import { helpHubHref } from "@/lib/help/help-hub-intents"
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
    <div className="space-y-3 lg:hidden">
      <Suspense fallback={null}>
        <DashboardMobileNav
          sellerProfileHref={sellerProfileHref}
          isAdmin={isAdmin}
          isShipper={isShipper}
          isDropoffLocation={isDropoffLocation}
          hasShopifyAccess={hasShopifyAccess}
          variant="account"
        />
      </Suspense>
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">Messages</h1>
        <Link
          href={helpHubHref()}
          className="pb-0.5 text-[15px] font-medium text-listingHeart"
        >
          Help
        </Link>
      </div>
    </div>
  )
}
