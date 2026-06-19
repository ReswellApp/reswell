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
  storeHubHref?: string | null
  storeHubName?: string | null
}

export function DashboardMobilePageChrome({
  sellerProfileHref,
  storeHubHref,
  storeHubName,
}: DashboardMobilePageChromeProps) {
  const pathname = usePathname() ?? ""
  const { sectionName, description } = resolveDashboardSectionMeta(pathname)

  return (
    <div className="space-y-5 pt-4 lg:hidden">
      <h1 className={dashboardPageTitleClass}>Dashboard - {sectionName}</h1>

      <DashboardMobileNav
        sellerProfileHref={sellerProfileHref}
        storeHubHref={storeHubHref}
        storeHubName={storeHubName}
        variant="account"
      />

      <header className="space-y-2 border-b border-border/60 pb-5">
        <h2 className={dashboardMobileSectionTitleClass}>{sectionName}</h2>
        <p className={cn(dashboardPageSubtitleClass, "mt-0")}>{description}</p>
      </header>
    </div>
  )
}
