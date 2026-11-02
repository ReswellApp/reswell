"use client"

import {
  shopifyBodyClass,
  shopifyDividerClass,
  shopifySectionTitleClass,
  shopifySurfaceClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import {
  RESWELL_SHOPIFY_COMMISSION_COPY,
  RESWELL_SHOPIFY_PRIVACY_PATH,
  RESWELL_SHOPIFY_TERMS_PATH,
  reswellMarketplaceUrl,
  shopifyAdminProductsUrl,
} from "@/lib/shopify/sales-channel"

interface ShopifySalesChannelPanelProps {
  shopDomain: string
  publishedCount: number
}

/**
 * Sales Channel App Store requirements 5.7.4–5.7.7 / 5.7.5:
 * publishing count + Shopify product manager link, marketplace link,
 * commission disclosure, and terms that open in a new window.
 */
export function ShopifySalesChannelPanel({
  shopDomain,
  publishedCount,
}: ShopifySalesChannelPanelProps) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : publicSiteOrigin()
  const marketplaceUrl = reswellMarketplaceUrl(origin)
  const productsUrl = shopifyAdminProductsUrl(shopDomain)

  return (
    <section className={shopifySurfaceClass}>
      <div className={`border-b px-5 py-4 ${shopifyDividerClass}`}>
        <h2 className={shopifySectionTitleClass}>Reswell sales channel</h2>
        <p className={`mt-1 ${shopifyBodyClass}`}>
          Publish the Shopify products you want shoppers to find on Reswell.
          Stock and price stay on Shopify; Reswell is the marketplace buyers use.
        </p>
      </div>
      <div className="space-y-4 px-5 py-4">
        <div>
          <p className="text-[13px] font-medium text-[#202223] dark:text-foreground">
            Publishing
          </p>
          <p className={`mt-1 ${shopifyBodyClass}`}>
            {publishedCount === 1
              ? "1 product is published on Reswell."
              : `${publishedCount} products are published on Reswell.`}{" "}
            <a
              href={productsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#2c6ecb] underline-offset-2 hover:underline"
            >
              Manage products in Shopify
            </a>
          </p>
        </div>
        <div>
          <p className="text-[13px] font-medium text-[#202223] dark:text-foreground">
            Marketplace
          </p>
          <p className={`mt-1 ${shopifyBodyClass}`}>
            After you publish, shoppers find those listings on{" "}
            <a
              href={marketplaceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#2c6ecb] underline-offset-2 hover:underline"
            >
              Reswell
            </a>
            .
          </p>
        </div>
        <div>
          <p className="text-[13px] font-medium text-[#202223] dark:text-foreground">
            Commission
          </p>
          <p className={`mt-1 ${shopifyBodyClass}`}>{RESWELL_SHOPIFY_COMMISSION_COPY}</p>
        </div>
        <div>
          <p className="text-[13px] font-medium text-[#202223] dark:text-foreground">
            Terms
          </p>
          <p className={`mt-1 ${shopifyBodyClass}`}>
            By connecting, you agree to Reswell&apos;s{" "}
            <a
              href={RESWELL_SHOPIFY_TERMS_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#2c6ecb] underline-offset-2 hover:underline"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href={RESWELL_SHOPIFY_PRIVACY_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#2c6ecb] underline-offset-2 hover:underline"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  )
}
