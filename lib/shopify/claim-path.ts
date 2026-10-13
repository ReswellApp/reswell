export const SHOPIFY_CLAIM_PATH = "/shopify/claim"
export const SHOPIFY_CONNECT_PATH = "/shopify/connect"

function isPath(pathname: string | null, path: string): boolean {
  return pathname === path || Boolean(pathname?.startsWith(`${path}/`))
}

/** Claim and connect share the install/sign-in chrome. Claim redirects to connect. */
export function isShopifyClaimPath(pathname: string | null): boolean {
  return isPath(pathname, SHOPIFY_CLAIM_PATH) || isPath(pathname, SHOPIFY_CONNECT_PATH)
}

export function shopifyConnectHref(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
): string {
  const query = new URLSearchParams()
  if (searchParams instanceof URLSearchParams) {
    for (const [key, value] of searchParams.entries()) {
      query.append(key, value)
    }
  } else {
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === "string") query.append(key, value)
      else if (Array.isArray(value)) {
        for (const item of value) query.append(key, item)
      }
    }
  }
  const serialized = query.toString()
  return serialized ? `${SHOPIFY_CONNECT_PATH}?${serialized}` : SHOPIFY_CONNECT_PATH
}
