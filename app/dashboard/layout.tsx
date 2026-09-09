import { redirect } from "next/navigation"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { sellerProfileHref } from "@/lib/seller-slug"
import { DashboardAppFrame } from "@/components/features/dashboard/dashboard-app-frame"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { supabase, user } = await getCachedDashboardSession()

  if (!user) {
    redirect("/auth/login?redirect=/dashboard")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_shop, seller_slug")
    .eq("id", user.id)
    .single()

  const isShop = profile?.is_shop || false
  const shopHref = isShop ? sellerProfileHref(profile) : null

  return <DashboardAppFrame sellerProfileHref={shopHref}>{children}</DashboardAppFrame>
}
