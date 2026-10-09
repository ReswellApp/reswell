/** User-facing connect URL after Shopify installs the app. */
export const SHOPIFY_CONNECT_PATH = "/shopify/connect"

/** Legacy public URL; redirects to {@link SHOPIFY_CONNECT_PATH}. */
export const SHOPIFY_CLAIM_PATH = "/shopify/claim"

function matchesPath(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`)
}

export function isShopifyConnectPath(pathname: string | null): boolean {
  if (!pathname) return false
  return (
    matchesPath(pathname, SHOPIFY_CONNECT_PATH) ||
    matchesPath(pathname, SHOPIFY_CLAIM_PATH)
  )
}

/** @deprecated Use {@link isShopifyConnectPath}. */
export const isShopifyClaimPath = isShopifyConnectPath
