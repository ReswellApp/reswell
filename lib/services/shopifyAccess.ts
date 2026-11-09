import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isShopifyConfigured,
  isShopifyIntegrationEnabled,
  isShopifyPublicOAuthEnabled,
  parseShopifyAppInstallUrl,
} from "@/lib/shopify/config"
import type { ShopifyConnectOptions } from "@/lib/shopify/types"

export type ShopifyMerchantAccess =
  | { allowed: true }
  | {
      allowed: false
      reason: "disabled" | "not_configured"
      message: string
    }

/**
 * Runtime gate for Shopify APIs/dashboard.
 * Any signed-in seller can connect after installing from the App Store —
 * do not require profiles.shopify_connect_enabled (that blocked reviewers).
 */
export async function checkShopifyMerchantAccess(
  _supabase: SupabaseClient,
  _userId: string,
): Promise<ShopifyMerchantAccess> {
  if (!isShopifyIntegrationEnabled()) {
    return {
      allowed: false,
      reason: "disabled",
      message: "Shopify integration is currently unavailable.",
    }
  }
  if (!isShopifyConfigured()) {
    return {
      allowed: false,
      reason: "not_configured",
      message: "Shopify integration is not configured.",
    }
  }
  return { allowed: true }
}

export const SHOPIFY_CONNECT_OPTIONS_UNAVAILABLE: ShopifyConnectOptions = {
  pluginAvailable: false,
  installUrl: null,
}

export function getShopifyDashboardConnectOptions(): ShopifyConnectOptions {
  const installUrl = isShopifyPublicOAuthEnabled()
    ? parseShopifyAppInstallUrl()
    : null
  return {
    pluginAvailable: Boolean(installUrl),
    installUrl,
  }
}
