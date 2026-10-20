import { notFound } from "next/navigation"
import { ShopifyIntegrationDashboard } from "@/components/features/integrations/shopify/shopify-integration-dashboard"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { getShopAccountContext } from "@/lib/services/accountAccess"
import { privatePageMetadata } from "@/lib/site-metadata"
import {
  isShopifyConfigured,
  isShopifyIntegrationEnabled,
} from "@/lib/shopify/config"
import { shopifyDashboardCallbackError } from "@/lib/shopify/connect-errors"
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
  const shop = await getShopAccountContext()
  if (shop && !shop.permissions.has("listings.read")) notFound()
  const accountId = shop?.accountId ?? user.id
  const access = await checkShopifyMerchantAccess(supabase, accountId)
  if (!access.allowed && access.reason === "not_approved") notFound()

  const status = access.allowed
    ? await getShopifyConnectionStatus(accountId)
    : null
  const shippingReadiness = await getShopifyShippingReadiness(
    supabase,
    accountId,
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
      connection.status === "active" &&
      connection.sync_enabled &&
      connection.billing_status === "active"
        ? listMerchantShopifyProducts({ userId: accountId })
        : null,
      getMerchantShopifyCatalog({
        userId: accountId,
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
    ? getShopifyDashboardConnectOptions()
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
      callbackError={shopifyDashboardCallbackError({
        errorFlag: params.error,
        detail: params.detail,
        connection,
        catalogTotal: catalog?.summary.total ?? 0,
      })}
    />
  )
}
