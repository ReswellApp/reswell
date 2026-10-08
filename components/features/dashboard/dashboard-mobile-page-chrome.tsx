"use client"

import { usePathname } from "next/navigation"
import { DashboardMobileNav } from "@/components/features/dashboard/dashboard-mobile-nav"
import { resolveDashboardSectionMeta } from "@/lib/dashboard-section-meta"
import {
  dashboardMobileSectionTitleClass,
  dashboardPageSubtitleClass,
  dashboardPageTitleClass,
} from "@/lib/utils/dashboard-display-styles"
import { cn } from "@/lib/utils"

export interface DashboardMobilePageChromeProps {
  sellerProfileHref: string | null
  isAdmin?: boolean
  isShipper?: boolean
  isDropoffLocation?: boolean
  hasShopifyAccess?: boolean
}

export function DashboardMobilePageChrome({
  sellerProfileHref,
  isAdmin = false,
  isShipper = false,
  isDropoffLocation = false,
  hasShopifyAccess = false,
}: DashboardMobilePageChromeProps) {
  const pathname = usePathname() ?? ""
  const { sectionName, description } = resolveDashboardSectionMeta(pathname)

  return (
    <div className="space-y-5 pt-4 lg:hidden">
      <h1 className={dashboardPageTitleClass}>Dashboard - {sectionName}</h1>

      <DashboardMobileNav
        sellerProfileHref={sellerProfileHref}
        isAdmin={isAdmin}
        isShipper={isShipper}
        isDropoffLocation={isDropoffLocation}
        hasShopifyAccess={hasShopifyAccess}
        variant="account"
      />

      <header className="space-y-2 border-b border-border/60 pb-5">
        <h2 className={dashboardMobileSectionTitleClass}>{sectionName}</h2>
        <p className={cn(dashboardPageSubtitleClass, "mt-0")}>{description}</p>
      </header>
    </div>
  )
}
