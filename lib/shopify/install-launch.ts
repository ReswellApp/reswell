import { shopifyConnectHref, SHOPIFY_CONNECT_PATH } from "@/lib/shopify/claim-path"
import { normalizeShopifyDomain } from "@/lib/shopify/config"
import { verifyShopifyOAuthHmac } from "@/lib/shopify/crypto"

export type ShopifyInstallLaunch =
  | { kind: "absent" }
  | { kind: "rejected" }
  | { kind: "verified"; shopDomain: string; returnPath: string }

export type ShopifyConnectInstallDecision =
  | { action: "continue_claim" }
  | { action: "reject_install" }
  | { action: "sign_in"; returnPath: string; shopDomain: string }
  | { action: "request_access"; shopDomain: string }
  | { action: "install_unavailable" }
  | { action: "start_public_install"; shopDomain: string }

function hasValue(params: URLSearchParams, key: string): boolean {
  return Boolean(params.get(key)?.trim())
}

/** Shopify App URL load: shop, hmac, timestamp, optional host, and no OAuth code. */
export function isShopifyInstallLaunchQuery(params: URLSearchParams): boolean {
  if (hasValue(params, "code")) return false
  return (
    hasValue(params, "shop") &&
    hasValue(params, "hmac") &&
    hasValue(params, "timestamp")
  )
}

function looksLikeShopifyInstallAttempt(params: URLSearchParams): boolean {
  return (
    hasValue(params, "shop") ||
    hasValue(params, "hmac") ||
    hasValue(params, "timestamp") ||
    hasValue(params, "host")
  )
}

/**
 * Verify the Shopify HMAC before the shop query is trusted.
 * A missing or invalid signature never becomes a verified launch.
 */
export function assessShopifyInstallLaunch(
  params: URLSearchParams,
): ShopifyInstallLaunch {
  if (hasValue(params, "code") || !looksLikeShopifyInstallAttempt(params)) {
    return { kind: "absent" }
  }
  if (!isShopifyInstallLaunchQuery(params)) return { kind: "rejected" }

  let hmacValid = false
  try {
    hmacValid = verifyShopifyOAuthHmac(params)
  } catch {
    hmacValid = false
  }
  if (!hmacValid) return { kind: "rejected" }

  const shopDomain = normalizeShopifyDomain(params.get("shop") ?? "")
  if (!shopDomain) return { kind: "rejected" }

  return {
    kind: "verified",
    shopDomain,
    returnPath: shopifyConnectHref(params) || SHOPIFY_CONNECT_PATH,
  }
}

export function decideShopifyConnectInstall(input: {
  launch: ShopifyInstallLaunch
  signedIn: boolean
  shopifyConnectEnabled: boolean
  publicInstallAvailable: boolean
}): ShopifyConnectInstallDecision {
  if (input.launch.kind === "absent") return { action: "continue_claim" }
  if (input.launch.kind === "rejected") return { action: "reject_install" }

  if (!input.signedIn) {
    return {
      action: "sign_in",
      returnPath: input.launch.returnPath,
      shopDomain: input.launch.shopDomain,
    }
  }
  if (!input.shopifyConnectEnabled) {
    return { action: "request_access", shopDomain: input.launch.shopDomain }
  }
  if (!input.publicInstallAvailable) return { action: "install_unavailable" }
  return {
    action: "start_public_install",
    shopDomain: input.launch.shopDomain,
  }
}
