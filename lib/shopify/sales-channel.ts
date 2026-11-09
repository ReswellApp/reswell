/** Channel specification handle from extensions/channel-config/specifications/reswell-us.toml */
export const RESWELL_CHANNEL_SPECIFICATION_HANDLE = "reswell-us"

/** Merchant-facing marketplace URL shown in the sales channel UI (requirement 5.7.5). */
export function reswellMarketplaceUrl(origin: string): string {
  return origin.replace(/\/$/, "")
}

/** Shopify admin products list for the linked store (publishing / bulk manage). */
export function shopifyAdminProductsUrl(shopDomain: string): string {
  const handle = shopDomain.replace(/\.myshopify\.com$/i, "")
  return `https://admin.shopify.com/store/${handle}/products`
}

export const RESWELL_SHOPIFY_COMMISSION_COPY =
  "Connected Reswell sales are charged a 7% usage fee once through Shopify Billing. That amount is not also taken from the Stripe payout."

export const RESWELL_SHOPIFY_TERMS_PATH = "/terms"
export const RESWELL_SHOPIFY_PRIVACY_PATH = "/privacy"
