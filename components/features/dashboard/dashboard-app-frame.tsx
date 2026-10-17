"use client"

import { Suspense, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"
import { AccountSwitcher, type AccountSwitcherOption } from "@/components/features/dashboard/account-switcher"
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
  accountOptions?: AccountSwitcherOption[]
  activeAccountId?: string
  actorUserId?: string
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
  accountOptions = [],
  activeAccountId,
  actorUserId,
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
          ? "w-full flex-1 bg-[#f6f6f7] px-4 pb-8 pt-4 text-[#202223] sm:px-6 lg:px-8 lg:pb-10 lg:pt-6 dark:bg-zinc-950 dark:text-foreground"
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
      {actorUserId && activeAccountId ? (
        <div className="mt-4 lg:hidden">
          <AccountSwitcher
            options={accountOptions}
            activeAccountId={activeAccountId}
            actorUserId={actorUserId}
          />
        </div>
      ) : null}
      {actingAsShop ? (
        <p className="mt-3 text-sm text-muted-foreground lg:hidden">
          Signed in as {actorEmail ?? "your email"}, working in {shopLabel ?? "this shop"}.
          {showShopAdminWarning ? " This does not open the Reswell admin panel." : ""}
        </p>
      ) : null}

      <div
        className={cn(
          "mt-5 flex flex-col lg:mt-0 lg:flex-row",
          shopifyAdmin ? "gap-6 lg:gap-8" : "gap-6 lg:gap-12 xl:gap-14",
        )}
      >
        <aside className={cn("hidden shrink-0 lg:block", dashboardSidebarWidthClass)}>
          <div className="sticky top-24 space-y-6">
            {actorUserId && activeAccountId ? (
              <AccountSwitcher
                options={accountOptions}
                activeAccountId={activeAccountId}
                actorUserId={actorUserId}
              />
            ) : null}
            {actingAsShop ? (
              <p className="text-sm text-muted-foreground">
                Signed in as {actorEmail ?? "your email"}, working in {shopLabel ?? "this shop"}.
                {showShopAdminWarning ? " This does not open the Reswell admin panel." : ""}
              </p>
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
