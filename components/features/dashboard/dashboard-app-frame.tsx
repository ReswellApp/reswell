"use client"

import { Suspense, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"
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
  children: ReactNode
}

export function DashboardAppFrame({ sellerProfileHref, children }: DashboardAppFrameProps) {
  const pathname = usePathname() ?? ""

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
    <div className="container mx-auto flex-1 pb-3 pt-5 sm:pb-6 sm:pt-6 lg:py-8">
      <DashboardMobilePageChrome sellerProfileHref={sellerProfileHref} />

      <div className="mt-5 flex flex-col gap-6 lg:mt-0 lg:flex-row lg:gap-12 xl:gap-14">
        <aside className={cn("hidden shrink-0 lg:block", dashboardSidebarWidthClass)}>
          <div className="sticky top-24 space-y-6">
            <Button asChild className={dashboardSidebarCreateButtonClass}>
              <Link href="/sell?new=1">
                <Plus className="mr-2 h-5 w-5" />
                Create Listing
              </Link>
            </Button>

            <Suspense fallback={null}>
              <DashboardSidebarNav sellerProfileHref={sellerProfileHref} size="large" />
            </Suspense>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
