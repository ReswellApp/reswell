"use client"

import { ShopifyPluginConnectOption } from "@/components/features/integrations/shopify/shopify-plugin-connect-option"
import {
  shopifyBodyClass,
  shopifyDividerClass,
  shopifySectionTitleClass,
  shopifySurfaceClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"
import { ShopifySyncHealthSummary } from "@/components/features/integrations/shopify/shopify-sync-health"
import type {
  PublicShopifyConnection,
  ShopifyConnectOptions,
  ShopifySyncHealth,
} from "@/lib/shopify/types"
import { cn } from "@/lib/utils"

interface ShopifyConnectionCardProps {
  connection: PublicShopifyConnection | null
  connectOptions: ShopifyConnectOptions
  health: ShopifySyncHealth | null
}

export function ShopifyConnectionCard({
  connection,
  connectOptions,
  health,
}: ShopifyConnectionCardProps) {
  if (!connection || connection.status === "disconnected") {
    return (
      <section className={shopifySurfaceClass}>
        <div className={`border-b px-4 py-3 ${shopifyDividerClass}`}>
          <h2 className={shopifySectionTitleClass}>Connect your Shopify store</h2>
          <p className={`mt-1 ${shopifyBodyClass}`}>
            Install the Reswell Shopify app and approve it on your store.
            Products and stock then sync to this account.
          </p>
        </div>
        <div className="p-3 sm:p-4">
          <ShopifyPluginConnectOption available={connectOptions.pluginAvailable} />
        </div>
      </section>
    )
  }

  const needsReconnect =
    connection.status === "reauthorization_required" ||
    connection.status === "error"

  return (
    <section className={shopifySurfaceClass}>
      {health ? (
        <ShopifySyncHealthSummary connection={connection} health={health} />
      ) : null}
      <p
        className={cn(
          "px-4 py-3",
          shopifyBodyClass,
          health && `border-t ${shopifyDividerClass}`,
        )}
      >
        {needsReconnect
          ? "Reconnect with the Reswell Shopify app to resume syncing. Deleted Shopify products are still removed from Reswell."
          : "Sync now removes products deleted in Shopify and refreshes every linked variant."}
      </p>
    </section>
  )
}
