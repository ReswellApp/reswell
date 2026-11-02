"use client"

import { useEffect } from "react"
import { ShopifyAccountConnectionPanel } from "@/components/features/integrations/shopify/shopify-account-connection-panel"
import { ShopifyAccountStatusBanners } from "@/components/features/integrations/shopify/shopify-account-status-banners"
import { ShopifySalesChannelPanel } from "@/components/features/integrations/shopify/shopify-sales-channel-panel"
import {
  shopifyBodyClass,
  shopifyCanvasClass,
  shopifyPrimaryButtonClass,
  shopifySectionTitleClass,
  shopifySurfaceClass,
  shopifyTitleClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"
import { Button } from "@/components/ui/button"
import { SHOPIFY_CONNECT_PATH } from "@/lib/shopify/claim-path"
import type { PublicShopifyConnection } from "@/lib/shopify/types"

interface ShopifyEmbeddedAppHomeProps {
  apiKey: string
  shopDomain: string
  host: string | null
  linked: boolean
  connection: PublicShopifyConnection | null
  publishedCount: number
  installUrl: string | null
}

/**
 * Sales Channel App Home loaded inside Shopify admin (App Bridge).
 * Account connection + approval banners stay visible; full catalog tools open
 * on Reswell in the top-level window.
 */
export function ShopifyEmbeddedAppHome({
  apiKey,
  shopDomain,
  host,
  linked,
  connection,
  publishedCount,
  installUrl,
}: ShopifyEmbeddedAppHomeProps) {
  useEffect(() => {
    if (typeof document === "undefined") return
    if (!document.querySelector('meta[name="shopify-api-key"]')) {
      const meta = document.createElement("meta")
      meta.name = "shopify-api-key"
      meta.content = apiKey
      document.head.prepend(meta)
    }
  }, [apiKey])

  const connectHref = `${SHOPIFY_CONNECT_PATH}?shop=${encodeURIComponent(shopDomain)}${
    host ? `&host=${encodeURIComponent(host)}` : ""
  }`

  return (
    <div className={shopifyCanvasClass}>
      <header className="space-y-1">
        <h1 className={shopifyTitleClass}>Reswell</h1>
        <p className={shopifyBodyClass}>
          Publish surf products from {shopDomain} to the Reswell marketplace.
        </p>
      </header>

      {linked && connection ? (
        <>
          <ShopifyAccountStatusBanners connection={connection} />
          <ShopifyAccountConnectionPanel
            connection={connection}
            manageHref="/dashboard/shopify"
          />
          <ShopifySalesChannelPanel
            shopDomain={shopDomain}
            publishedCount={publishedCount}
          />
        </>
      ) : (
        <section className={shopifySurfaceClass}>
          <div className="space-y-3 px-5 py-4">
            <h2 className={shopifySectionTitleClass}>Connect your Reswell account</h2>
            <p className={shopifyBodyClass}>
              Finish installing Reswell, then sign in to link this Shopify store to
              your Reswell seller account. Authentication opens outside the Shopify
              admin.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {installUrl ? (
                <Button type="button" asChild className={shopifyPrimaryButtonClass}>
                  <a href={installUrl} target="_top" rel="noopener noreferrer">
                    Continue Shopify install
                  </a>
                </Button>
              ) : (
                <Button type="button" asChild className={shopifyPrimaryButtonClass}>
                  <a href={connectHref} target="_top" rel="noopener noreferrer">
                    Sign in to Reswell
                  </a>
                </Button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
