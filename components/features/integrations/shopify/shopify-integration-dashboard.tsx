"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShopifyCatalogNotice } from "@/components/features/integrations/shopify/shopify-catalog-notice"
import { ShopifyConnectionCard } from "@/components/features/integrations/shopify/shopify-connection-card"
import { ShopifyDashboardAlerts } from "@/components/features/integrations/shopify/shopify-dashboard-alerts"
import { ShopifyInventoryScopeNote } from "@/components/features/integrations/shopify/shopify-inventory-scope-note"
import { ShopifyLinkedListingsPanel } from "@/components/features/integrations/shopify/shopify-linked-listings-panel"
import { ShopifyPageHeader } from "@/components/features/integrations/shopify/shopify-page-header"
import { ShopifyProductPicker } from "@/components/features/integrations/shopify/shopify-product-picker"
import { ShopifyReswellPublishPanel } from "@/components/features/integrations/shopify/shopify-reswell-publish-panel"
import { ShopifySetupPanel } from "@/components/features/integrations/shopify/shopify-setup-panel"
import { ShopifyShippingReadinessCard } from "@/components/features/integrations/shopify/shopify-shipping-readiness-card"
import {
  shopifyCanvasClass,
  shopifyTabListClass,
  shopifyTabTriggerClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"
import { useShopifyIntegration } from "@/components/features/integrations/shopify/hooks/use-shopify-integration"
import { useShopifyLinkedListings } from "@/components/features/integrations/shopify/hooks/use-shopify-linked-listings"
import type { ShopifyDashboardData } from "@/lib/shopify/types"

type DashboardTab = "listings" | "add" | "setup"

interface ShopifyIntegrationDashboardProps {
  initialData: ShopifyDashboardData
  connected: boolean
  callbackError: string | null
}

export function ShopifyIntegrationDashboard({
  initialData,
  connected,
  callbackError,
}: ShopifyIntegrationDashboardProps) {
  const integration = useShopifyIntegration(initialData)
  const linked = useShopifyLinkedListings(initialData.catalog)
  const [tab, setTab] = useState<DashboardTab>(
    connected && !initialData.catalog?.summary.total ? "add" : "listings",
  )
  const runtimeReady = initialData.enabled && initialData.configured
  const connection = integration.connection
  const connectedAndActive =
    runtimeReady &&
    connection?.status === "active" &&
    connection.sync_enabled &&
    connection.billing_status === "active"
  const catalog = connection && connection.status !== "disconnected" ? linked.catalog : null
  const shopifyCatalogEmpty =
    connectedAndActive &&
    !integration.loading &&
    integration.products.length === 0 &&
    integration.query.trim() === ""
  const showConnection = Boolean(
    runtimeReady && connection && connection.status !== "disconnected",
  )

  const picker = connectedAndActive ? (
    <ShopifyProductPicker
      products={integration.products}
      query={integration.query}
      busyProductId={integration.busyProductId}
      loading={integration.loading}
      hasNextPage={integration.pageInfo.hasNextPage}
      linkedCount={catalog?.summary.total ?? 0}
      onQueryChange={integration.setQuery}
      onSearch={() => void integration.loadProducts(false)}
      onLoadMore={() => void integration.loadProducts(true)}
      onPublish={async (productId, section) => {
        if (await integration.publishProduct(productId, section)) await linked.load()
      }}
      onUnpublish={async (productId) => {
        if (await integration.unpublishProduct(productId)) await linked.load()
      }}
      onViewLinked={() => setTab("listings")}
    />
  ) : null

  async function syncNow() {
    if (await integration.requestSync()) await linked.load()
  }

  async function unpublish(productId: string) {
    linked.setBusyProductId(productId)
    if (await integration.unpublishProduct(productId)) await linked.load()
    linked.setBusyProductId(null)
  }

  return (
    <div className={shopifyCanvasClass}>
      <ShopifyPageHeader
        connection={connection}
        showConnection={showConnection}
        health={catalog?.health ?? null}
        busy={integration.connectionBusy}
        onSync={() => void syncNow()}
        onDisconnect={() => void integration.disconnect()}
      />

      <ShopifyDashboardAlerts
        runtimeReady={runtimeReady}
        configured={initialData.configured}
        error={callbackError ?? initialData.loadError}
      />

      {runtimeReady && (!connection || connection.status === "disconnected") ? (
        <ShopifyConnectionCard
          connection={connection}
          connectOptions={initialData.connectOptions}
        />
      ) : null}

      {catalog && connection ? (
        <Tabs value={tab} onValueChange={(value) => setTab(value as DashboardTab)}>
          <TabsList className={shopifyTabListClass}>
            <TabsTrigger value="listings" className={shopifyTabTriggerClass}>
              Listings
            </TabsTrigger>
            <TabsTrigger
              value="add"
              className={shopifyTabTriggerClass}
              disabled={!connectedAndActive}
            >
              {connection.source_of_truth === "reswell" ? "Add listings" : "Add products"}
            </TabsTrigger>
            <TabsTrigger value="setup" className={shopifyTabTriggerClass}>
              Setup
            </TabsTrigger>
          </TabsList>
          <TabsContent value="listings" className="mt-4 space-y-3 focus-visible:ring-0">
            <ShopifyCatalogNotice
              shopDomain={connection.shop_domain}
              catalog={catalog}
              shopifyCatalogEmpty={shopifyCatalogEmpty}
              busy={integration.connectionBusy}
              onSyncNow={() => void syncNow()}
            />
            <ShopifyLinkedListingsPanel
              catalog={catalog}
              controller={linked}
              canSync={connectedAndActive}
              onUnpublish={(productId) => void unpublish(productId)}
              onBrowseShopify={() => setTab("add")}
            />
          </TabsContent>
          <TabsContent value="add" className="mt-4 focus-visible:ring-0">
            {connectedAndActive && connection.source_of_truth === "reswell" ? (
              <ShopifyReswellPublishPanel />
            ) : (
              picker
            )}
          </TabsContent>
          <TabsContent value="setup" className="mt-4 space-y-3 focus-visible:ring-0">
            <ShopifySetupPanel
              connection={connection}
              onSourceChange={integration.setSourceOfTruth}
            />
            <ShopifyShippingReadinessCard readiness={initialData.shippingReadiness} />
            <ShopifyInventoryScopeNote />
          </TabsContent>
        </Tabs>
      ) : (
        <>
          {picker}
          {connection && connection.status !== "disconnected" ? (
            <ShopifySetupPanel
              connection={connection}
              onSourceChange={integration.setSourceOfTruth}
            />
          ) : null}
          <ShopifyShippingReadinessCard readiness={initialData.shippingReadiness} />
          <ShopifyInventoryScopeNote />
        </>
      )}
    </div>
  )
}
