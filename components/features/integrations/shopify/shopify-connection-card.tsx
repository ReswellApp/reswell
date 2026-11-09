"use client"

import { ShopifyPluginConnectOption } from "@/components/features/integrations/shopify/shopify-plugin-connect-option"
import {
  shopifyBodyClass,
  shopifyDividerClass,
  shopifySectionTitleClass,
  shopifySurfaceClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"
import type {
  PublicShopifyConnection,
  ShopifyConnectOptions,
} from "@/lib/shopify/types"

interface ShopifyConnectionCardProps {
  connection: PublicShopifyConnection | null
  connectOptions: ShopifyConnectOptions
}

export function ShopifyConnectionCard({
  connection,
  connectOptions,
}: ShopifyConnectionCardProps) {
  if (connection && connection.status !== "disconnected") return null

  return (
    <section className={shopifySurfaceClass}>
      <div className={`border-b px-5 py-4 ${shopifyDividerClass}`}>
        <h2 className={shopifySectionTitleClass}>Connect your Shopify store</h2>
        <p className={`mt-1 max-w-2xl ${shopifyBodyClass}`}>
          Install the Reswell Shopify app and approve it on your store.
          Products and stock then sync to this account.
        </p>
      </div>
      <div className="px-5 py-4">
        <ShopifyPluginConnectOption
          available={connectOptions.pluginAvailable}
          installUrl={connectOptions.installUrl}
        />
      </div>
    </section>
  )
}
