import type { SupabaseClient } from "@supabase/supabase-js"
import { dbShopifyUserIsEligible } from "@/lib/db/shopifyConnections"
import {
  isShopifyConfigured,
  isShopifyIntegrationEnabled,
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
  const eligible = await dbShopifyUserIsEligible(supabase, userId)
  if (!eligible) {
    return {
      allowed: false,
      reason: "not_approved",
      message: "Your account is not approved for Shopify yet.",
    }
  }
  return { allowed: true }
}
