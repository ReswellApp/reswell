import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { CreditCard, Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getConsignmentStoreBySlug, getStoreStaffRole } from "@/lib/db/consignmentStores"
import { profileHasConsignmentShopRole } from "@/lib/services/consignmentShopAccess"
import { sellerProfileHref } from "@/lib/seller-slug"
import { Button } from "@/components/ui/button"
import { StoreSidebarNav } from "@/components/features/consignment/store-sidebar-nav"
import { StoreMobileChrome } from "@/components/features/consignment/store-mobile-chrome"
import {
  dashboardSidebarWidthClass,
} from "@/lib/utils/dashboard-display-styles"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const store = await getConsignmentStoreBySlug(supabase, slug)
  if (!store) {
    notFound()
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(`/stores/${slug}/dashboard`)}`)
  }

  const role = await getStoreStaffRole(supabase, store.id, user.id)
  if (!role) {
    notFound()
  }

  const granted = await profileHasConsignmentShopRole(supabase, user.id)
  if (!granted) {
    notFound()
  }

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("seller_slug, is_shop")
    .eq("id", store.ownerProfileId)
    .maybeSingle()

  const publicProfileHref =
    ownerProfile?.is_shop && ownerProfile.seller_slug
      ? sellerProfileHref(ownerProfile)
      : null

  return (
    <div className="container mx-auto flex-1 pb-3 pt-5 sm:pb-6 sm:pt-6 lg:py-8">
      <StoreMobileChrome slug={slug} storeName={store.name} role={role} />

      <div className="mt-5 flex flex-col gap-6 lg:mt-0 lg:flex-row lg:gap-12 xl:gap-14">
        <aside className={cn("shrink-0", dashboardSidebarWidthClass)}>
          <div className="sticky top-24 space-y-6">
            <Button asChild className="hidden w-full lg:inline-flex" size="lg">
              <Link href={`/stores/${slug}/pos`}>
                <CreditCard className="mr-2 h-5 w-5" />
                Open register
              </Link>
            </Button>
            <Button asChild variant="outline" className="hidden w-full lg:inline-flex" size="lg">
              <Link href="/sell?new=1">
                <Plus className="mr-2 h-5 w-5" />
                Create listing
              </Link>
            </Button>
            <StoreSidebarNav
              slug={slug}
              storeName={store.name}
              role={role}
              sellerProfileHref={publicProfileHref}
            />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
