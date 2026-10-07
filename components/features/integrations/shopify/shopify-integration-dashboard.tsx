"use client"

import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { ShopifyConnectionCard } from "@/components/features/integrations/shopify/shopify-connection-card"
import { ShopifyProductPicker } from "@/components/features/integrations/shopify/shopify-product-picker"
import { ShopifyShippingReadinessCard } from "@/components/features/integrations/shopify/shopify-shipping-readiness-card"
import { useShopifyIntegration } from "@/components/features/integrations/shopify/hooks/use-shopify-integration"
import type { ShopifyDashboardData } from "@/lib/shopify/types"
import {
  dashboardPageSubtitleClass,
  dashboardPageTitleClass,
} from "@/lib/utils/dashboard-display-styles"

interface ShopifyIntegrationDashboardProps {
  initialData: ShopifyDashboardData
  connected: boolean
  callbackError: boolean
}

export function ShopifyIntegrationDashboard({
  initialData,
  connected,
  callbackError,
}: ShopifyIntegrationDashboardProps) {
  const integration = useShopifyIntegration(initialData)
  const runtimeReady = initialData.enabled && initialData.configured
  const connectedAndActive =
    runtimeReady &&
    integration.connection?.status === "active" &&
    integration.connection.sync_enabled

  return (
    <div className="space-y-6">
      <header>
        <h1 className={dashboardPageTitleClass}>Shopify inventory</h1>
        <p className={dashboardPageSubtitleClass}>
          Choose products to sell on Reswell while Shopify remains the source of
          truth for product details, variants, and stock.
        </p>
      </header>

      {connected ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Shopify connected</AlertTitle>
          <AlertDescription>
            Select the individual products you want to publish on Reswell.
          </AlertDescription>
        </Alert>
      ) : null}
      {!runtimeReady ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Shopify access approved</AlertTitle>
          <AlertDescription>
            {initialData.configured
              ? "The integration is temporarily paused. Your Shopify access is still approved."
              : "Reswell is finishing the Shopify app setup. This page will become active when configuration is complete."}
          </AlertDescription>
        </Alert>
      ) : null}
      {runtimeReady && (callbackError || initialData.loadError) ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Shopify needs attention</AlertTitle>
          <AlertDescription>
            {initialData.loadError ||
              "The Shopify connection could not be completed. Try connecting again."}
          </AlertDescription>
        </Alert>
      ) : null}

      {runtimeReady ? (
        <ShopifyConnectionCard
          connection={integration.connection}
          busy={integration.connectionBusy}
          onSync={() => void integration.requestSync()}
          onDisconnect={() => void integration.disconnect()}
        />
      ) : null}

      <ShopifyShippingReadinessCard
        readiness={initialData.shippingReadiness}
      />

      {connectedAndActive ? (
        <ShopifyProductPicker
          products={integration.products}
          query={integration.query}
          busyProductId={integration.busyProductId}
          loading={integration.loading}
          hasNextPage={integration.pageInfo.hasNextPage}
          onQueryChange={integration.setQuery}
          onSearch={() => void integration.loadProducts(false)}
          onLoadMore={() => void integration.loadProducts(true)}
          onPublish={(productId, section) =>
            void integration.publishProduct(productId, section)
          }
          onUnpublish={(productId) =>
            void integration.unpublishProduct(productId)
          }
        />
      ) : null}

      <Card className="border-primary/15 bg-primary/[0.03]">
        <CardContent className="flex gap-3 p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="text-sm">
            <p className="font-medium text-foreground">Inventory-only access</p>
            <p className="mt-1 text-muted-foreground">
              Reswell does not read or sync Shopify orders, customers, payments,
              fulfillments, cancellations, or refunds. A Reswell sale only
              decrements the linked Shopify inventory item.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
