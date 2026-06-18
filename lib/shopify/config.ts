import { publicSiteOrigin } from "@/lib/public-site-origin"

export const SHOPIFY_API_VERSION = "2025-01"

/**
 * Scopes for the pro channel:
 *  - read_products / read_inventory: catalog + stock mirror (Shopify → Reswell)
 *  - write_inventory: decrement Shopify on a Reswell sale (prevents oversell)
 *  - read_orders / write_orders: create the real Shopify order for the seller
 *  - read_fulfillments / write_fulfillments: push Reswell shipping tracking back to Shopify
 *  - read_locations: multi-location inventory adjustments
 */
export const SHOPIFY_DEFAULT_SCOPES = [
  "read_products",
  "read_inventory",
  "write_inventory",
  "read_orders",
  "write_orders",
  "read_fulfillments",
  "write_fulfillments",
  "read_locations",
].join(",")

export function isShopifyConfigured(): boolean {
  return Boolean(
    process.env.SHOPIFY_API_KEY?.trim() && process.env.SHOPIFY_API_SECRET?.trim(),
  )
}

export function shopifyApiKey(): string {
  const key = process.env.SHOPIFY_API_KEY?.trim()
  if (!key) throw new Error("SHOPIFY_API_KEY is not configured")
  return key
}

export function shopifyApiSecret(): string {
  const secret = process.env.SHOPIFY_API_SECRET?.trim()
  if (!secret) throw new Error("SHOPIFY_API_SECRET is not configured")
  return secret
}

export function shopifyOAuthRedirectUri(): string {
  return `${publicSiteOrigin()}/api/integrations/shopify/callback`
}

/** REST Admin API base for a shop, pinned to {@link SHOPIFY_API_VERSION}. */
export function shopifyRestBase(shopDomain: string): string {
  return `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}`
}

/** GraphQL Admin API endpoint — used for bulk operations and efficient catalog reads. */
export function shopifyGraphqlEndpoint(shopDomain: string): string {
  return `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`
}

export function normalizeShopDomain(raw: string): string | null {
  let value = raw.trim().toLowerCase()
  if (!value) return null
  value = value.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  if (!value.includes(".")) {
    value = `${value}.myshopify.com`
  }
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value)) {
    return null
  }
  return value
}
