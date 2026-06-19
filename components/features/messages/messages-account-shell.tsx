import React, { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { sellerProfileHref } from "@/lib/seller-slug"
import { storeNavHref } from "@/lib/store-nav-links"
import { getConsignmentShopOperatorContext } from "@/lib/services/consignmentShopAccess"
import { Button } from "@/components/ui/button"
import { DashboardSidebarNav } from "@/components/features/dashboard/dashboard-sidebar-nav"
import { MessagesAccountShellClient } from "@/components/features/messages/messages-account-shell-client"

export async function MessagesAccountShell({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getCachedDashboardSession()

  if (!user) {
    redirect("/auth/login?redirect=/messages")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_shop, seller_slug")
    .eq("id", user.id)
    .single()

  const shopHref = profile?.is_shop ? sellerProfileHref(profile) : null

  const operatorContext = await getConsignmentShopOperatorContext(supabase, user.id)
  const primaryStore = operatorContext?.primaryStore ?? null
  const storeHubHref = primaryStore
    ? storeNavHref(primaryStore.store.slug, "/dashboard")
    : null
  const storeHubName = primaryStore?.store.name ?? null

  return (
    <MessagesAccountShellClient
      sellerProfileHref={shopHref}
      storeHubHref={storeHubHref}
      storeHubName={storeHubName}
      sidebar={
        <aside className="hidden shrink-0 lg:block lg:w-64 xl:w-72">
          <div className="sticky top-24 space-y-5">
            <Button asChild className="h-10 w-full lg:h-11 lg:text-[15px]">
              <Link href="/sell?new=1">
                <Plus className="mr-2 h-4 w-4" />
                Create Listing
              </Link>
            </Button>

            <Suspense fallback={null}>
              <DashboardSidebarNav
                sellerProfileHref={shopHref}
                storeHubHref={storeHubHref}
                storeHubName={storeHubName}
              />
            </Suspense>
          </div>
        </aside>
      }>
      {children}
    </MessagesAccountShellClient>
  )
}
