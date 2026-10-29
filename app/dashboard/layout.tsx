import { redirect } from "next/navigation"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { sellerProfileHref } from "@/lib/seller-slug"
import { DashboardAppFrame } from "@/components/features/dashboard/dashboard-app-frame"
import { coastalShipperMembership } from "@/lib/services/coastalShipperAccess"
import { dropoffLocationMembership } from "@/lib/services/dropoffLocationAccess"
import { getShopAccountContext } from "@/lib/services/accountAccess"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { supabase, user } = await getCachedDashboardSession()

  if (!user) {
    redirect("/auth/login?redirect=/dashboard/listings")
  }

  const shop = await getShopAccountContext()
  if (!shop) {
    redirect("/auth/login?redirect=/dashboard/listings")
  }

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
  const shopHref =
    shop.isShop && shop.sellerSlug ? sellerProfileHref({ seller_slug: shop.sellerSlug }) : null

  return (
    <DashboardAppFrame
      sellerProfileHref={shopHref}
      isAdmin={shop.platformAdmin}
      isShipper={isShipper}
      isDropoffLocation={isDropoffLocation}
      hasShopifyAccess={shop.shopifyConnectEnabled}
      showEarnings={shop.permissions.has("payouts.read")}
      actingAsShop={shop.actingAsShop}
      shopLabel={shop.shopLabel}
      accountRole={shop.role}
      actorDisplayName={shop.actorDisplayName}
      actorEmail={shop.actorEmail}
      showShopAdminWarning={
        shop.actingAsShop &&
        shop.accountIsPlatformAdmin &&
        !shop.platformAdmin &&
        !shop.platformEmployee
      }
    >
      {children}
    </DashboardAppFrame>
  )
}
