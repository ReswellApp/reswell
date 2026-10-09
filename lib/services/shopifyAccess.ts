import type { SupabaseClient } from "@supabase/supabase-js"
import {
  dbShopifyUserIsEligible,
  dbShopifyUserManualCanaryEnabled,
} from "@/lib/db/shopifyConnections"
import {
  isShopifyConfigured,
  isShopifyIntegrationEnabled,
  isShopifyManualCanaryEnabled,
  isShopifyPublicOAuthConfigured,
  isShopifyPublicOAuthEnabled,
  shopifyAppInstallUrl,
} from "@/lib/shopify/config"

export type ShopifyMerchantAccess =
  | { allowed: true }
  | {
      allowed: false
      reason: "disabled" | "not_configured" | "not_approved"
      message: string
    }

export async function checkShopifyMerchantAccess(
  supabase: SupabaseClient,
  userId: string,
): Promise<ShopifyMerchantAccess> {
  const eligible = await dbShopifyUserIsEligible(supabase, userId)
  if (!eligible) {
    return {
      allowed: false,
      reason: "not_approved",
      message: "Your account is not approved for Shopify yet.",
    }
  }
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

export async function getShopifyDashboardConnectOptions(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  publicOAuthEnabled: boolean
  manualCanaryEnabled: boolean
  appInstallUrl: string | null
}> {
  const publicOAuthEnabled =
    isShopifyPublicOAuthEnabled() && isShopifyPublicOAuthConfigured()
  const manualCanaryEnabled =
    isShopifyManualCanaryEnabled() &&
    (await dbShopifyUserManualCanaryEnabled(supabase, userId))
  return {
    publicOAuthEnabled,
    manualCanaryEnabled,
    appInstallUrl: publicOAuthEnabled ? shopifyAppInstallUrl() : null,
  }
}
