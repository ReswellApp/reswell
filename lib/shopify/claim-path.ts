export const SHOPIFY_CLAIM_PATH = "/shopify/claim"

export function isShopifyClaimPath(pathname: string | null): boolean {
  return pathname === SHOPIFY_CLAIM_PATH || Boolean(pathname?.startsWith(`${SHOPIFY_CLAIM_PATH}/`))
}
