import React from "react"
import { redirect } from "next/navigation"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { sellerProfileHref } from "@/lib/seller-slug"
import { MessagesAccountShellClient } from "@/components/features/messages/messages-account-shell-client"
import { coastalShipperMembership } from "@/lib/services/coastalShipperAccess"
import { dropoffLocationMembership } from "@/lib/services/dropoffLocationAccess"
import { getShopAccountContext } from "@/lib/services/accountAccess"
import { accountHasShopifyNavLink } from "@/lib/services/shopifyNavAccess"

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
  const shop = await getShopAccountContext()
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
  const hasShopifyAccess = await accountHasShopifyNavLink(shop?.accountId ?? user.id)

  return (
    <MessagesAccountShellClient
      sellerProfileHref={shopHref}
      isAdmin={profile?.is_admin === true}
      isShipper={isShipper}
      isDropoffLocation={isDropoffLocation}
      hasShopifyAccess={hasShopifyAccess}
    >
      {children}
    </MessagesAccountShellClient>
  )
}
