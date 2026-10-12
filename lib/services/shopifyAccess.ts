import type { SupabaseClient } from "@supabase/supabase-js"
import {
  dbShopifyUserIsEligible,
  dbShopifyUserManualCanaryEnabled,
} from "@/lib/db/shopifyConnections"
import {
  isShopifyAccountOAuthConfigured,
  isShopifyConfigured,
  isShopifyIntegrationEnabled,
  isShopifyManualCanaryEnabled,
} from "@/lib/shopify/config"
import type {
  ShopifyConnectOptions,
  ShopifyManualSetupState,
} from "@/lib/shopify/types"

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

export const SHOPIFY_CONNECT_OPTIONS_UNAVAILABLE: ShopifyConnectOptions = {
  pluginAvailable: false,
  manualSetup: "disabled",
}

export function resolveShopifyManualSetupState(input: {
  envEnabled: boolean
  profileAllowlisted: boolean
}): ShopifyManualSetupState {
  if (!input.envEnabled) return "disabled"
  if (!input.profileAllowlisted) return "needs_approval"
  return "available"
}

export async function getShopifyDashboardConnectOptions(
  supabase: SupabaseClient,
  userId: string,
): Promise<ShopifyConnectOptions> {
  const envEnabled = isShopifyManualCanaryEnabled()
  const profileAllowlisted = envEnabled
    ? await dbShopifyUserManualCanaryEnabled(supabase, userId)
    : false
  return {
    pluginAvailable: isShopifyAccountOAuthConfigured(),
    manualSetup: resolveShopifyManualSetupState({
      envEnabled,
      profileAllowlisted,
    }),
  }
}
