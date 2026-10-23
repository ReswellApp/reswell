import { publicSiteOrigin } from "@/lib/public-site-origin"

export const SHOPIFY_API_VERSION =
  process.env.SHOPIFY_API_VERSION?.trim() || "2026-10"

export const SHOPIFY_MVP_SCOPES = [
  "read_products",
  "write_products",
  "read_inventory",
  "write_inventory",
  "read_locations",
  "read_orders",
  "write_orders",
] as const

export const SHOPIFY_READ_SCOPES = [
  "read_products",
  "read_inventory",
  "read_locations",
] as const

export function missingShopifyReadScopes(granted: string[]): string[] {
  const grantedSet = new Set(granted)
  return SHOPIFY_READ_SCOPES.filter((scope) => !grantedSet.has(scope))
}

export function missingShopifyOperationalScopes(granted: string[]): string[] {
  const grantedSet = new Set(granted)
  return SHOPIFY_MVP_SCOPES.filter((scope) => !grantedSet.has(scope))
}

/** Development stores reject live charges. Production leaves this unset. */
export function shopifyBillingTestMode(): boolean {
  return process.env.SHOPIFY_BILLING_TEST?.trim().toLowerCase() === "true"
}

export function isShopifyIntegrationEnabled(): boolean {
  return process.env.SHOPIFY_INTEGRATION_ENABLED?.trim().toLowerCase() === "true"
}

export function isShopifyPublicOAuthEnabled(): boolean {
  return (
    isShopifyIntegrationEnabled() &&
    process.env.SHOPIFY_PUBLIC_OAUTH_ENABLED?.trim().toLowerCase() === "true"
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
    isShopifyAccountOAuthConfigured()
  )
}

/** Reswell-started OAuth only needs the app credentials, not an install URL. */
export function isShopifyAccountOAuthConfigured(): boolean {
  return Boolean(
    process.env.SHOPIFY_API_KEY?.trim() &&
      process.env.SHOPIFY_API_SECRET?.trim(),
  )
}

export function isShopifyPublicOAuthConfigured(): boolean {
  return isShopifyAccountOAuthConfigured() && Boolean(parseShopifyAppInstallUrl())
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

const SHOPIFY_APP_INSTALL_HOSTS = new Set([
  "admin.shopify.com",
  "apps.shopify.com",
  "shopify.com",
  "www.shopify.com",
])

export function parseShopifyAppInstallUrl(): string | null {
  const value = process.env.SHOPIFY_APP_INSTALL_URL?.trim()
  if (!value) return null
  try {
    const url = new URL(value)
    if (
      url.protocol !== "https:" ||
      !SHOPIFY_APP_INSTALL_HOSTS.has(url.hostname)
    ) {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

export function shopifyAppInstallUrl(): string {
  const parsed = parseShopifyAppInstallUrl()
  if (parsed) return parsed
  if (!process.env.SHOPIFY_APP_INSTALL_URL?.trim()) {
    throw new Error("SHOPIFY_APP_INSTALL_URL is not configured")
  }
  throw new Error("SHOPIFY_APP_INSTALL_URL must be a Shopify-owned HTTPS URL")
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
