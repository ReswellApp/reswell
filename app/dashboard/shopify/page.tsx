import { notFound } from "next/navigation"
import { ShopifyIntegrationDashboard } from "@/components/features/integrations/shopify/shopify-integration-dashboard"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { privatePageMetadata } from "@/lib/site-metadata"
import {
  isShopifyConfigured,
  isShopifyIntegrationEnabled,
  isShopifyManualCanaryEnabled,
  isShopifyPublicOAuthConfigured,
  isShopifyPublicOAuthEnabled,
  shopifyAppInstallUrl,
} from "@/lib/shopify/config"
import { dbShopifyUserManualCanaryEnabled } from "@/lib/db/shopifyConnections"
import type { ShopifyDashboardData } from "@/lib/shopify/types"
import { checkShopifyMerchantAccess } from "@/lib/services/shopifyAccess"
import {
  getShopifyConnectionStatus,
  listMerchantShopifyProducts,
} from "@/lib/services/shopifyConnection"
import { getShopifyShippingReadiness } from "@/lib/services/shopifyShipping"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Shopify — Reswell",
  description: "Connect Shopify and choose the products you sell on Reswell.",
  path: "/dashboard/shopify",
})

export default async function ShopifyIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const { supabase, user } = await getCachedDashboardSession()
  if (!user) return null
  const access = await checkShopifyMerchantAccess(supabase, user.id)
  if (!access.allowed && access.reason === "not_approved") notFound()

  const status = access.allowed
    ? await getShopifyConnectionStatus(user.id)
    : null
  const shippingReadiness = await getShopifyShippingReadiness(
    supabase,
    user.id,
  )
  const connection = status?.ok ? status.data : null
  let products: ShopifyDashboardData["products"] = []
  let productPageInfo: ShopifyDashboardData["productPageInfo"] = {
    hasNextPage: false,
    endCursor: null,
  }
  let loadError = access.allowed
    ? status?.ok
      ? null
      : status?.error ?? "Could not load Shopify status"
    : access.message

  if (connection?.status === "active" && connection.sync_enabled) {
    const listed = await listMerchantShopifyProducts({ userId: user.id })
    if (listed.ok) {
      products = listed.data.products
      productPageInfo = listed.data.pageInfo
    } else {
      loadError = listed.error
    }
  }

  const manualCanaryEnabled =
    access.allowed &&
    isShopifyManualCanaryEnabled() &&
    (await dbShopifyUserManualCanaryEnabled(supabase, user.id))

  const params = await searchParams
  return (
    <ShopifyIntegrationDashboard
      initialData={{
        enabled: isShopifyIntegrationEnabled(),
        configured: isShopifyConfigured(),
        publicOAuthEnabled:
          isShopifyPublicOAuthEnabled() && isShopifyPublicOAuthConfigured(),
        manualCanaryEnabled,
        appInstallUrl:
          isShopifyPublicOAuthEnabled() && isShopifyPublicOAuthConfigured()
            ? shopifyAppInstallUrl()
            : null,
        connection,
        products,
        productPageInfo,
        shippingReadiness,
        loadError,
      }}
      connected={params.connected === "1"}
      callbackError={params.error === "1"}
    />
  )
}
