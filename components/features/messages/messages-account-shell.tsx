import React, { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { sellerProfileHref } from "@/lib/seller-slug"
import { Button } from "@/components/ui/button"
import { DashboardSidebarNav } from "@/components/features/dashboard/dashboard-sidebar-nav"
import { MessagesAccountShellClient } from "@/components/features/messages/messages-account-shell-client"
import { coastalShipperMembership } from "@/lib/services/coastalShipperAccess"
import { dropoffLocationMembership } from "@/lib/services/dropoffLocationAccess"

export async function MessagesAccountShell({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getCachedDashboardSession()

  if (!user) {
    redirect("/auth/login?redirect=/messages")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_shop, is_admin, seller_slug, shopify_connect_enabled")
    .eq("id", user.id)
    .single()

  const shopHref = profile?.is_shop ? sellerProfileHref(profile) : null
  const [{ data: shipperRow, error: shipperError }, { data: dropoffRow, error: dropoffError }] =
    await Promise.all([
      supabase.from("coastal_shippers").select("id").eq("user_id", user.id).maybeSingle(),
      supabase.from("dropoff_location_grants").select("id").eq("user_id", user.id).maybeSingle(),
    ])
  const isShipper = coastalShipperMembership({ rowId: shipperRow?.id, queryFailed: Boolean(shipperError) })
  const isDropoffLocation = dropoffLocationMembership({
    rowId: dropoffRow?.id,
    queryFailed: Boolean(dropoffError),
  })
  const hasShopifyAccess = profile?.shopify_connect_enabled === true

  return (
    <MessagesAccountShellClient
      sellerProfileHref={shopHref}
      isAdmin={profile?.is_admin === true}
      isShipper={isShipper}
      isDropoffLocation={isDropoffLocation}
      hasShopifyAccess={hasShopifyAccess}
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
                isAdmin={profile?.is_admin === true}
                isShipper={isShipper}
                isDropoffLocation={isDropoffLocation}
                hasShopifyAccess={hasShopifyAccess}
              />
            </Suspense>
          </div>
        </aside>
      }>
      {children}
    </MessagesAccountShellClient>
  )
}
