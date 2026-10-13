import { notFound } from "next/navigation"
import { ShopifyIntegrationDashboard } from "@/components/features/integrations/shopify/shopify-integration-dashboard"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { privatePageMetadata } from "@/lib/site-metadata"
import {
  isShopifyConfigured,
  isShopifyIntegrationEnabled,
} from "@/lib/shopify/config"
import { shopifyConnectErrorMessage } from "@/lib/shopify/connect-errors"
import type { ShopifyDashboardData } from "@/lib/shopify/types"
import {
  SHOPIFY_CONNECT_OPTIONS_UNAVAILABLE,
  checkShopifyMerchantAccess,
  getShopifyDashboardConnectOptions,
} from "@/lib/services/shopifyAccess"
import {
  getShopifyConnectionStatus,
  listMerchantShopifyProducts,
} from "@/lib/services/shopifyConnection"
import { getMerchantShopifyCatalog } from "@/lib/services/shopifyCatalogManager"
import { getShopifyShippingReadiness } from "@/lib/services/shopifyShipping"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Shopify — Reswell",
  description: "Manage the Shopify products you sell on Reswell.",
  path: "/dashboard/shopify",
})

export default async function ShopifyIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; detail?: string }>
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

  let catalog: ShopifyDashboardData["catalog"] = null
  if (connection) {
    const [listed, managed] = await Promise.all([
      connection.status === "active" && connection.sync_enabled
        ? listMerchantShopifyProducts({ userId: user.id })
        : null,
      getMerchantShopifyCatalog({
        userId: user.id,
        filter: "all",
        section: null,
        query: "",
        page: 1,
      }),
    ])
    if (listed?.ok) {
      products = listed.data.products
      productPageInfo = listed.data.pageInfo
    } else if (listed) {
      loadError = listed.error
    }
    if (managed.ok) catalog = managed.data
    else loadError ??= managed.error
  }

  const connectOptions = access.allowed
    ? await getShopifyDashboardConnectOptions(supabase, user.id)
    : SHOPIFY_CONNECT_OPTIONS_UNAVAILABLE

  const params = await searchParams
  return (
    <ShopifyIntegrationDashboard
      initialData={{
        enabled: isShopifyIntegrationEnabled(),
        configured: isShopifyConfigured(),
        connectOptions,
        connection,
        products,
        productPageInfo,
        catalog,
        shippingReadiness,
        loadError,
      }}
      connected={params.connected === "1"}
      callbackError={
        params.error === "1" ? shopifyConnectErrorMessage(params.detail) : null
      }
    />
  )
}
