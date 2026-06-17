import { publicSiteOrigin } from "@/lib/public-site-origin"

export const SHOPIFY_API_VERSION = "2024-10"

export const SHOPIFY_DEFAULT_SCOPES = [
  "read_products",
  "read_inventory",
  "write_orders",
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
