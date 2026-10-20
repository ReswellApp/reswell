"use client"

import { Suspense, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"
import { OpenPersonalAccountButton } from "@/components/features/dashboard/account-switcher"
import { DashboardMobilePageChrome } from "@/components/features/dashboard/dashboard-mobile-page-chrome"
import { DashboardSidebarNav } from "@/components/features/dashboard/dashboard-sidebar-nav"
import { Button } from "@/components/ui/button"
import {
  dashboardSidebarCreateButtonClass,
  dashboardSidebarWidthClass,
} from "@/lib/utils/dashboard-display-styles"
import { isDashboardSupportDeskPath } from "@/lib/utils/dashboard-support-path"
import { cn } from "@/lib/utils"

interface DashboardAppFrameProps {
  sellerProfileHref: string | null
  isAdmin?: boolean
  isShipper?: boolean
  isDropoffLocation?: boolean
  hasShopifyAccess?: boolean
  showEarnings?: boolean
  actingAsShop?: boolean
  shopLabel?: string
  actorEmail?: string | null
  showShopAdminWarning?: boolean
  children: ReactNode
}

export function DashboardAppFrame({
  sellerProfileHref,
  isAdmin = false,
  isShipper = false,
  isDropoffLocation = false,
  hasShopifyAccess = false,
  showEarnings = true,
  actingAsShop = false,
  shopLabel,
  actorEmail,
  showShopAdminWarning = false,
  children,
}: DashboardAppFrameProps) {
  const pathname = usePathname() ?? ""
  const shopifyAdmin = pathname === "/dashboard/shopify"

  if (isDashboardSupportDeskPath(pathname)) {
    return (
      <div className="flex-1">
        <div className="container mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 xl:max-w-4xl">
          {children}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        shopifyAdmin
          ? "w-full flex-1 bg-[#f1f1f1] px-4 pb-8 pt-4 text-[#303030] sm:px-6 lg:px-8 lg:pb-10 lg:pt-6 dark:bg-zinc-950 dark:text-foreground"
          : "container mx-auto flex-1 pb-3 pt-5 sm:pb-6 sm:pt-6 lg:py-8",
      )}
    >
      <DashboardMobilePageChrome
        sellerProfileHref={sellerProfileHref}
        isAdmin={isAdmin}
        isShipper={isShipper}
        isDropoffLocation={isDropoffLocation}
        hasShopifyAccess={hasShopifyAccess}
        showEarnings={showEarnings}
      />
      {actingAsShop ? (
        <div className="mt-4 rounded-2xl border border-neutral-200/80 bg-white px-4 py-3 lg:hidden">
          <p className="text-sm font-medium text-foreground">{shopLabel ?? "Shop"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Signed in as {actorEmail ?? "your email"}.
            {showShopAdminWarning ? " This does not open the Reswell admin panel." : ""}
          </p>
          <OpenPersonalAccountButton />
        </div>
      ) : null}

      <div
        className={cn(
          "mt-5 flex flex-col lg:mt-0 lg:flex-row",
          shopifyAdmin ? "gap-6 lg:gap-8" : "gap-6 lg:gap-12 xl:gap-14",
        )}
      >
        <aside className={cn("hidden shrink-0 lg:block", dashboardSidebarWidthClass)}>
          <div className="sticky top-24 space-y-6">
            {actingAsShop ? (
              <div className="rounded-2xl border border-neutral-200/80 bg-white px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Working in
                </p>
                <p className="mt-1 truncate text-sm font-medium text-foreground">{shopLabel ?? "Shop"}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {actorEmail ?? "Your email"}
                  {showShopAdminWarning ? " · Admin panel stays separate" : ""}
                </p>
                <OpenPersonalAccountButton />
              </div>
            ) : null}
            <Button asChild className={dashboardSidebarCreateButtonClass}>
              <Link href="/sell?new=1">
                <Plus className="mr-2 h-5 w-5" />
                Create Listing
              </Link>
            </Button>

            <Suspense fallback={null}>
              <DashboardSidebarNav
                sellerProfileHref={sellerProfileHref}
                isAdmin={isAdmin}
                isShipper={isShipper}
                isDropoffLocation={isDropoffLocation}
                hasShopifyAccess={hasShopifyAccess}
                showEarnings={showEarnings}
                size="large"
              />
            </Suspense>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
