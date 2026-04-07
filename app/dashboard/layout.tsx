import React from "react"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { Button } from "@/components/ui/button"
import { sellerProfileHref } from "@/lib/seller-slug"
import {
  LayoutDashboard,
  Package,
  PackageCheck,
  Archive,
  Heart,
  ShoppingBag,
  Plus,
  Store,
  UserCircle,
  Banknote,
  Users,
} from "lucide-react"

const sidebarLinks = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "My Listings", href: "/dashboard/listings", icon: Package },
  { name: "Archived", href: "/dashboard/listings/archived", icon: Archive },
  { name: "Earnings & Payouts", href: "/dashboard/earnings", icon: Banknote },
  { name: "Favorites", href: "/dashboard/favorites", icon: Heart },
  { name: "Followers", href: "/dashboard/followers", icon: Users },
  { name: "Orders", href: "/dashboard/orders", icon: ShoppingBag },
  { name: "Sales", href: "/dashboard/sales", icon: PackageCheck },
  { name: "Profile", href: "/dashboard/profile", icon: UserCircle },
]

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

  return (
      <div className="flex-1 container mx-auto py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-4">
              <Button asChild className="w-full">
                <Link href="/sell">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Listing
                </Link>
              </Button>
              
              <nav className="space-y-1">
                {sidebarLinks.map((link) => {
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
