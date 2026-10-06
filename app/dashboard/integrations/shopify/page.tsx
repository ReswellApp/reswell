import { notFound } from "next/navigation"
import { ShopifyIntegrationDashboard } from "@/components/features/integrations/shopify/shopify-integration-dashboard"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { privatePageMetadata } from "@/lib/site-metadata"
import type { ShopifyDashboardData } from "@/lib/shopify/types"
import { checkShopifyMerchantAccess } from "@/lib/services/shopifyAccess"
import {
  getShopifyConnectionStatus,
  listMerchantShopifyProducts,
} from "@/lib/services/shopifyConnection"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Shopify — Reswell",
  description: "Connect Shopify and choose the products you sell on Reswell.",
  path: "/dashboard/integrations/shopify",
})

export default async function ShopifyIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const { supabase, user } = await getCachedDashboardSession()
  if (!user) return null
  const access = await checkShopifyMerchantAccess(supabase, user.id)
  if (!access.allowed) notFound()

  const status = await getShopifyConnectionStatus(user.id)
  const connection = status.ok ? status.data : null
  let products: ShopifyDashboardData["products"] = []
  let productPageInfo: ShopifyDashboardData["productPageInfo"] = {
    hasNextPage: false,
    endCursor: null,
  }
  let loadError = status.ok ? null : status.error

  if (connection?.status === "active" && connection.sync_enabled) {
    const listed = await listMerchantShopifyProducts({ userId: user.id })
    if (listed.ok) {
      products = listed.data.products
      productPageInfo = listed.data.pageInfo
    } else {
      loadError = listed.error
    }
  }

  const params = await searchParams
  return (
    <ShopifyIntegrationDashboard
      initialData={{
        enabled: true,
        configured: true,
        connection,
        products,
        productPageInfo,
        loadError,
      }}
      connected={params.connected === "1"}
      callbackError={params.error === "1"}
    />
  )
}
