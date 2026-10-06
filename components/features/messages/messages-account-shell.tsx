import React, { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { sellerProfileHref } from "@/lib/seller-slug"
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
    .select("is_shop, is_admin, seller_slug")
    .eq("id", user.id)
    .single()

  const shopHref = profile?.is_shop ? sellerProfileHref(profile) : null
  const { data: shipperRow, error: shipperError } = await supabase
    .from("coastal_shippers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()
  const isShipper = !shipperError && typeof shipperRow?.id === "string"

  return (
    <MessagesAccountShellClient
      sellerProfileHref={shopHref}
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
              />
            </Suspense>
          </div>
        </aside>
      }>
      {children}
    </MessagesAccountShellClient>
  )
}
