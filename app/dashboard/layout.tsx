import React from "react"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { Button } from "@/components/ui/button"
import { sellerProfileHref } from "@/lib/seller-slug"
import { DASHBOARD_NAV_LINKS } from "@/lib/dashboard-nav-links"
import { DashboardMobileNav } from "@/components/features/dashboard/dashboard-mobile-nav"
import { Plus, Store } from "lucide-react"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { supabase, user } = await getCachedDashboardSession()

  if (!user) {
    redirect("/auth/login?redirect=/dashboard")
  }

  // Check if user is a shop
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_shop, seller_slug")
    .eq("id", user.id)
    .single()
  
  const isShop = profile?.is_shop || false

  const shopHref = isShop ? sellerProfileHref(profile) : null

  return (
      <div className="flex-1 container mx-auto py-6 sm:py-8">
        <DashboardMobileNav sellerProfileHref={shopHref} />

        <div className="mt-6 flex flex-col gap-8 lg:mt-0 lg:flex-row lg:gap-10 xl:gap-12">
          {/* Sidebar */}
          <aside className="hidden shrink-0 lg:block lg:w-56 xl:w-64">
            <div className="sticky top-24 space-y-4">
              <Button asChild className="w-full">
                <Link href="/sell?new=1">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Listing
                </Link>
              </Button>
              
              <nav className="hidden space-y-1 lg:block">
                {DASHBOARD_NAV_LINKS.map((link) => {
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <Icon className="h-4 w-4" />
                      {link.name}
                    </Link>
                  )
                })}
                {isShop && (
                  <Link
                    href={sellerProfileHref(profile)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-primary hover:text-primary hover:bg-primary/5 transition-colors"
                  >
                    <Store className="h-4 w-4" />
                    My Seller Profile
                  </Link>
                )}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
  )
}
