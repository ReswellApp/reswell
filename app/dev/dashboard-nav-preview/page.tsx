import { notFound } from "next/navigation"
import { Suspense } from "react"
import { DashboardSidebarNav } from "@/components/features/dashboard/dashboard-sidebar-nav"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import {
  dashboardSidebarCreateButtonClass,
  dashboardSidebarStickyScrollClass,
  dashboardSidebarWidthClass,
} from "@/lib/utils/dashboard-display-styles"
import { cn } from "@/lib/utils"

export default function DashboardNavPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound()

  return (
    <div className="container mx-auto flex-1 pb-8 pt-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard nav preview</h1>
        <p className="text-sm text-muted-foreground">
          Dev-only shell to review Selling / Buying / Account grouping without auth.
        </p>
      </div>
      <div className="flex flex-col gap-12 lg:flex-row">
        <aside className={cn("shrink-0", dashboardSidebarWidthClass, dashboardSidebarStickyScrollClass)}>
          <div className="space-y-6">
            <Button asChild className={dashboardSidebarCreateButtonClass}>
              <Link href="/sell?new=1">
                <Plus className="mr-2 h-5 w-5" />
                Create Listing
              </Link>
            </Button>
            <Suspense fallback={null}>
              <DashboardSidebarNav
                sellerProfileHref="/sellers/example-shop"
                isAdmin
                isShipper
                isDropoffLocation
                hasShopifyAccess
                showEarnings
                size="large"
              />
            </Suspense>
          </div>
        </aside>
        <main className="min-h-[220vh] min-w-0 flex-1 rounded-xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
          <p>
            Main content area (placeholder). Use the sidebar to confirm Selling, Buying, and Account
            sections.
          </p>
          <p className="mt-4">
            This column is intentionally taller than the viewport. Scroll it with the pointer over
            the page, then scroll the sidebar with the pointer over the nav. Each should move on
            its own.
          </p>
        </main>
      </div>
    </div>
  )
}
