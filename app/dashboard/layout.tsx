import { redirect } from "next/navigation"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { sellerProfileHref } from "@/lib/seller-slug"
import { DashboardAppFrame } from "@/components/features/dashboard/dashboard-app-frame"
import { coastalShipperMembership } from "@/lib/services/coastalShipperAccess"
import { dropoffLocationMembership } from "@/lib/services/dropoffLocationAccess"

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
    .select("is_shop, is_admin, seller_slug, shopify_connect_enabled")
    .eq("id", user.id)
    .single()

  const isShop = profile?.is_shop || false
  const shopHref = isShop ? sellerProfileHref(profile) : null
  const hasShopifyAccess = profile?.shopify_connect_enabled === true
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

  return (
    <DashboardAppFrame
      sellerProfileHref={shopHref}
      isAdmin={profile?.is_admin === true}
      isShipper={isShipper}
      isDropoffLocation={isDropoffLocation}
      hasShopifyAccess={hasShopifyAccess}
    >
      {children}
    </DashboardAppFrame>
  )
}
