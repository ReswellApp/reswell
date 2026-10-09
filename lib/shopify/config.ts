import { publicSiteOrigin } from "@/lib/public-site-origin"

export const SHOPIFY_API_VERSION =
  process.env.SHOPIFY_API_VERSION?.trim() || "2026-10"

export const SHOPIFY_MVP_SCOPES = [
  "read_products",
  "read_inventory",
  "write_inventory",
  "read_locations",
] as const

export const SHOPIFY_READ_SCOPES = [
  "read_products",
  "read_inventory",
  "read_locations",
] as const

export function isShopifyIntegrationEnabled(): boolean {
  return process.env.SHOPIFY_INTEGRATION_ENABLED?.trim().toLowerCase() === "true"
}

export function isShopifyPublicOAuthEnabled(): boolean {
  return (
    isShopifyIntegrationEnabled() &&
    process.env.SHOPIFY_PUBLIC_OAUTH_ENABLED?.trim().toLowerCase() === "true"
  )
}

export function isShopifyManualCanaryEnabled(): boolean {
  return (
    isShopifyIntegrationEnabled() &&
    process.env.SHOPIFY_MANUAL_CANARY_ENABLED?.trim().toLowerCase() === "true"
  )
}

export function areShopifyInventoryWritesEnabled(): boolean {
  return (
    isShopifyIntegrationEnabled() &&
    process.env.SHOPIFY_INVENTORY_WRITES_ENABLED?.trim().toLowerCase() === "true"
  )
}

export function isShopifyConfigured(): boolean {
  return (
    Boolean(process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY?.trim()) &&
    (isShopifyPublicOAuthConfigured() || isShopifyManualCanaryEnabled())
  )
}

export function isShopifyPublicOAuthConfigured(): boolean {
  return Boolean(
    process.env.SHOPIFY_API_KEY?.trim() &&
      process.env.SHOPIFY_API_SECRET?.trim() &&
      process.env.SHOPIFY_APP_INSTALL_URL?.trim(),
  )
}

export function shopifyApiKey(): string {
  const value = process.env.SHOPIFY_API_KEY?.trim()
  if (!value) throw new Error("SHOPIFY_API_KEY is not configured")
  return value
}

export function shopifyApiSecret(): string {
  const value = process.env.SHOPIFY_API_SECRET?.trim()
  if (!value) throw new Error("SHOPIFY_API_SECRET is not configured")
  return value
}

export function shopifyTokenEncryptionKeyVersion(): number {
  const value = Number(process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION ?? "1")
  return Number.isInteger(value) && value > 0 ? value : 1
}

export function shopifyOAuthRedirectUri(): string {
  return `${publicSiteOrigin()}/api/integrations/shopify/callback`
}

export function shopifyWebhookUri(): string {
  return `${publicSiteOrigin()}/api/webhooks/shopify`
}

export function shopifyManualWebhookUri(routeKey: string): string {
  return `${publicSiteOrigin()}/api/webhooks/shopify/manual/${encodeURIComponent(
    routeKey,
  )}`
}

export function shopifyAppInstallUrl(): string {
  const value = process.env.SHOPIFY_APP_INSTALL_URL?.trim()
  if (!value) throw new Error("SHOPIFY_APP_INSTALL_URL is not configured")
  const url = new URL(value)
  const allowedHosts = new Set([
    "apps.shopify.com",
    "admin.shopify.com",
    "shopify.com",
    "www.shopify.com",
  ])
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) {
    throw new Error("SHOPIFY_APP_INSTALL_URL must be a Shopify-owned HTTPS URL")
  }
  return url.toString()
}

export function shopifyGraphqlEndpoint(shopDomain: string): string {
  return `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`
}

export function normalizeShopifyDomain(raw: string): string | null {
  let value = raw.trim().toLowerCase()
  if (!value) return null
  value = value.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  if (!value.includes(".")) value = `${value}.myshopify.com`
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value)) return null
  return value
}
